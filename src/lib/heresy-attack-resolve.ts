/**
 * Turns weapon and unit *names* into heresy_attack_calculator inputs, so one
 * tool call answers "what do ten bolter shots do to Legionaries?" from the
 * data. The caller never has to carry stats between tools, which is where a
 * voice LLM goes wrong (skipping the calculator and inventing a number).
 *
 * A weapon with several profiles (plasma gun Maximal / Sustained) yields one
 * result per profile. Anything not stated is assumed and reported as a note.
 */
import { HERESY_WEAPONS } from "../data/heresy-weapons.js";
import type { HeresyMeleeWeapon, HeresyModelProfile, HeresyRangedWeapon, HeresyUnit } from "../types.js";
import type { HeresyAttackInput } from "./heresy-attack.js";
import { findHeresyWeapons } from "./heresy-format.js";
import { findHeresyUnit } from "./heresy-unit-match.js";

export type AttackRequest = Partial<HeresyAttackInput> & {
  weapon?: string;
  target?: string;
  attacker?: string;
  firingModels?: number;
  facing?: "front" | "side" | "rear";
};

export type ResolvedAttack = { label: string; input: HeresyAttackInput };
export type Resolution = { attacks: ResolvedAttack[]; notes: string[]; error?: string };

/** "4+" → 4, "7" → 7, "-" or "" → undefined. */
function num(v: string | undefined): number | undefined {
  const m = String(v ?? "").match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

/** The unit's rank-and-file model: the named one, else the one it fields most of (not its Sergeant). */
function mainModel(unit: HeresyUnit, named?: string): HeresyModelProfile | undefined {
  if (named) {
    const m = unit.models.find((x) => x.name === named);
    if (m) return m;
  }
  const maxOf = (m: HeresyModelProfile) => Math.max(0, ...unit.composition.filter((c) => c.model === m.name).map((c) => c.max));
  return [...unit.models].sort((a, b) => maxOf(b) - maxOf(a))[0];
}

function armourValue(unit: HeresyUnit, facing: string): number | undefined {
  const stats = unit.armoured[0]?.stats ?? [];
  const f = facing.toLowerCase();
  const stat = stats.find((s) => s.name.toLowerCase() === `${f} armour`) ?? stats.find((s) => s.name.toLowerCase() === f);
  return num(stat?.value);
}

/** The bearer's Strength with a melee weapon's modifier: "S" → S, "+4" → S+4, "x2" → S×2, "8" → 8. */
export function meleeStrength(modifier: string, bearer: number): number {
  const v = modifier.trim();
  if (/^[+-]\s*\d+$/.test(v)) return bearer + Number(v.replace(/\s+/g, ""));
  if (/^[x×]\s*\d+$/i.test(v)) return bearer * Number(v.replace(/^[x×]\s*/i, ""));
  return /^\d+$/.test(v) ? Number(v) : bearer;
}

function meleeAttacks(modifier: string, bearer: number): number {
  return Math.max(1, meleeStrength(modifier, bearer));
}

export function resolveHeresyAttack(r: AttackRequest): Resolution {
  const notes: string[] = [];

  let attacker: HeresyModelProfile | undefined;
  if (r.attacker) {
    const m = findHeresyUnit(r.attacker);
    if (!m) return { attacks: [], notes, error: `No Horus Heresy unit found matching attacker "${r.attacker}".` };
    attacker = mainModel(m.unit, m.kind === "model" ? m.model : undefined);
  }

  // Target
  const target: Partial<HeresyAttackInput> = {};
  if (r.target) {
    const m = findHeresyUnit(r.target);
    if (!m) return { attacks: [], notes, error: `No Horus Heresy unit found matching target "${r.target}".` };
    const model = m.unit.models.length ? mainModel(m.unit, m.kind === "model" ? m.model : undefined) : undefined;
    if (model && !/vehicle/i.test(model.type)) {
      target.toughness = num(model.toughness);
      target.targetWeaponSkill = num(model.weaponSkill);
      target.armourSave = num(model.save);
      target.invulnerableSave = num(model.invulnerableSave);
      target.woundsPerModel = num(model.wounds);
      notes.push(`Target: ${model.name} (${m.unit.name}): T${model.toughness}, W${model.wounds}, SAV ${model.save}, INV ${model.invulnerableSave}.`);
    } else {
      const facing = r.facing ?? "front";
      const av = armourValue(m.unit, facing);
      if (av === undefined) return { attacks: [], notes, error: `No ${facing} armour value found for "${m.unit.name}".` };
      target.targetArmour = av;
      notes.push(`Target: ${m.unit.name}, ${facing} armour ${av}.`);
    }
  }

  const base = (extra: Partial<HeresyAttackInput>): HeresyAttackInput => {
    // Numbers given explicitly always win over looked-up ones.
    const defined = Object.fromEntries(
      Object.entries(r).filter(([k, v]) => v !== undefined && !["weapon", "target", "attacker", "firingModels", "facing"].includes(k)),
    );
    return { attackType: "ranged", attacks: 1, strength: 4, damage: "1", ...target, ...extra, ...defined } as HeresyAttackInput;
  };

  if (!r.weapon) {
    if (r.attacks === undefined || r.strength === undefined || r.damage === undefined) {
      return { attacks: [], notes, error: "Give a weapon name, or attacks, strength and damage." };
    }
    if (r.attackType === "ranged" && attacker && r.ballisticSkill === undefined) target.ballisticSkill = num(attacker.ballisticSkill);
    return { attacks: [{ label: "", input: base({}) }], notes };
  }

  // Weapon
  const entries = findHeresyWeapons(HERESY_WEAPONS, r.weapon);
  if (!entries.length) return { attacks: [], notes, error: `No Horus Heresy weapon found matching "${r.weapon}".` };
  const entry = entries.find((e) => e.source === "Weapons") ?? entries[0];
  const melee = r.attackType === "melee" || (r.attackType === undefined && entry.ranged.length === 0);
  if (melee && !entry.melee.length) return { attacks: [], notes, error: `"${entry.name}" has no melee profile.` };
  if (!melee && !entry.ranged.length) return { attacks: [], notes, error: `"${entry.name}" has no ranged profile.` };

  const attacks: ResolvedAttack[] = [];
  if (melee) {
    const ws = num(attacker?.weaponSkill);
    const s = num(attacker?.strength);
    const a = num(attacker?.attacks);
    if (!attacker && r.weaponSkill === undefined) notes.push("No attacker named: assuming WS 4, Strength 4, Attacks 1.");
    for (const p of entry.melee as HeresyMeleeWeapon[]) {
      const count = (r.firingModels ?? 1) * meleeAttacks(p.attacksModifier === "A" ? "" : p.attacksModifier, a ?? 1);
      attacks.push({
        label: entry.melee.length > 1 ? p.name : "",
        input: base({
          attackType: "melee",
          weaponSkill: ws ?? 4,
          attacks: count,
          strength: meleeStrength(p.strengthModifier === "S" ? "" : p.strengthModifier, s ?? 4),
          ap: num(p.ap),
          damage: p.damage,
          specialRules: p.specialRules,
        }),
      });
    }
  } else {
    if (!attacker && r.ballisticSkill === undefined) notes.push("No firer named: assuming BS 4.");
    for (const p of entry.ranged as HeresyRangedWeapon[]) {
      const fp = num(p.firepower) ?? 1;
      const strength = num(p.rangedStrength);
      if (strength === undefined) continue; // e.g. a profile with no Strength: nothing to calculate
      attacks.push({
        label: entry.ranged.length > 1 ? p.name : "",
        input: base({
          attackType: "ranged",
          ballisticSkill: num(attacker?.ballisticSkill) ?? 4,
          attacks: r.attacks ?? (r.firingModels ?? 1) * fp,
          strength,
          ap: num(p.ap),
          damage: p.damage,
          specialRules: p.specialRules,
        }),
      });
    }
    if (r.attacks === undefined) notes.push(`${r.firingModels ?? 1} model${(r.firingModels ?? 1) === 1 ? "" : "s"} firing, at the weapon's Firepower.`);
  }
  if (!attacks.length) return { attacks: [], notes, error: `"${entry.name}" has no profile the calculator can use.` };
  return { attacks, notes };
}
