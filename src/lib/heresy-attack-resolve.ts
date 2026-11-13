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
  /** A Titan's or Ordinatus's profile to target ("legs", "carapace", "gun"…). */
  location?: string;
  /** That profile is Crippled: use its Exposed Armour. */
  crippled?: boolean;
  /** Titan or Ordinatus profiles already Crippled ("arms", "legs"), for comparing locations. */
  crippledLocations?: string[];
  /** Void shields still up, when the querent says (otherwise the unit's full X). */
  shieldsUp?: number;
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

function stat(stats: { name: string; value: string }[], ...names: string[]): number | undefined {
  for (const n of names) {
    const s = stats.find((x) => x.name.toLowerCase() === n);
    if (s && num(s.value) !== undefined) return num(s.value);
  }
  return undefined;
}

/**
 * The Armour Value an attack tests against. Titans and Ordinatus have a profile per location with
 * Primary and Exposed Armour (Exposed once that profile is Crippled); other vehicles and Knights
 * have one profile with an Armour Value per facing. Knights have only Front and Rear.
 */
type Location = { name: string; av: number; label: string; crippled: boolean; titan: boolean };

/**
 * The Armour Value(s) an attack tests against. Titans and Ordinatus have a profile per location with
 * Primary and Exposed Armour (Exposed once that profile is Crippled): one location if named, else all
 * of them, to compare. Other vehicles and Knights have one profile with an Armour Value per facing;
 * Knights have only Front and Rear.
 */
function armourValues(unit: HeresyUnit, r: AttackRequest, notes: string[]): { locations: Location[]; error?: string } {
  const located = unit.armoured.filter((a) => stat(a.stats, "primary armour", "primary") !== undefined);
  if (located.length) {
    const titan = unit.armoured.some((a) => /^titan/i.test(a.kind));
    const crippled = new Set((r.crippledLocations ?? []).map((c) => c.toLowerCase().replace(/s$/, "")));
    if (r.crippled && r.location) crippled.add(r.location.toLowerCase().replace(/s$/, ""));
    const isCrippled = (name: string) => [...crippled].some((c) => name.toLowerCase().replace(/s$/, "").includes(c));
    const want = r.location?.toLowerCase().replace(/s$/, "");
    let chosen = want ? located.filter((a) => a.name.toLowerCase().includes(want) || want.includes(a.name.toLowerCase().replace(/s$/, ""))) : located;
    if (want && !chosen.length) {
      notes.push(`No "${r.location}" profile; comparing all of them.`);
      chosen = located;
    }
    const locations = chosen.map((prof) => {
      const c = isCrippled(prof.name);
      const av = (c ? stat(prof.stats, "exposed armour", "exposed") : stat(prof.stats, "primary armour", "primary"))!;
      const hp = stat(prof.stats, "hp");
      return { name: prof.name, av, crippled: c, titan, label: `${prof.name}: ${c ? "Crippled, Exposed" : "Primary"} Armour ${av}${hp !== undefined ? `, ${hp} Hull Points` : ""}` };
    });
    if (locations.length > 1) notes.push("No location named: comparing every profile.");
    return { locations };
  }
  const stats = unit.armoured[0]?.stats ?? [];
  let facing = (r.facing ?? "front").toLowerCase();
  if (facing === "side" && stat(stats, "side armour", "side") === undefined && stat(stats, "front armour", "front") !== undefined) {
    notes.push("This profile has only Front and Rear armour: using Front.");
    facing = "front";
  }
  const av = stat(stats, `${facing} armour`, facing);
  if (av === undefined) return { locations: [], error: `No ${facing} armour value found for "${unit.name}".` };
  const hp = stat(stats, "hp", "hull points");
  return { locations: [{ name: "", av, crippled: false, titan: false, label: `${facing} armour ${av}${hp !== undefined ? `, ${hp} Hull Points` : ""}` }] };
}

/** "Void Shields (3)" → 3. */
function ruleValue(rules: string[], name: RegExp): number | undefined {
  for (const r of rules) {
    const m = r.match(name);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Ion shields: 5+ Invulnerable against Shooting at the Front, 6+ at the Rear (and against Glancing Hits). */
function ionShield(unit: HeresyUnit): { name: string; flare: boolean } | undefined {
  const names = [...(unit.wargearRules ?? []).map((w) => w.name), ...unit.specialRules];
  const ion = names.find((n) => /^ion(ic flare)? shield$/i.test(n));
  if (ion) return { name: ion, flare: /flare/i.test(ion) };
  return names.some((n) => /^flare shield$/i.test(n)) ? { name: "Flare Shield", flare: true } : undefined;
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

/**
 * A vehicle, Knight or Titan as the attacker: its BS, WS, S and A from its armoured profile(s).
 * A Titan's BS sits on its Arms profile, so take the first profile that has each value.
 */
function vehicleAsModel(unit: HeresyUnit): HeresyModelProfile | undefined {
  if (!unit.armoured.length) return undefined;
  const pick = (name: string) => unit.armoured.map((a) => a.stats.find((s) => s.name.toLowerCase() === name)?.value).find((v) => num(v) !== undefined) ?? "-";
  return {
    name: unit.armoured[0].name, type: "Vehicle", movement: pick("m"), weaponSkill: pick("ws"), ballisticSkill: pick("bs"),
    strength: pick("s"), toughness: "-", wounds: "-", initiative: pick("i"), attacks: pick("a"),
    leadership: "-", cool: "-", willpower: "-", intelligence: "-", save: "-", invulnerableSave: "-",
  };
}

export function resolveHeresyAttack(r: AttackRequest): Resolution {
  const notes: string[] = [];

  let attacker: HeresyModelProfile | undefined;
  let attackerKnight = false;
  if (r.attacker) {
    const m = findHeresyUnit(r.attacker);
    if (!m) return { attacks: [], notes, error: `No Horus Heresy unit found matching attacker "${r.attacker}".` };
    attacker = mainModel(m.unit, m.kind === "model" ? m.model : undefined) ?? vehicleAsModel(m.unit);
    attackerKnight = m.unit.armoured.some((a) => /knight|antigrav/i.test(a.stats.find((s) => s.name.toLowerCase() === "type")?.value ?? "")) ||
      m.unit.models.some((x) => /knight|antigrav/i.test(x.type));
    if (attacker && attacker.type === "Vehicle") notes.push(`Attacker: ${m.unit.name}: BS ${attacker.ballisticSkill}, WS ${attacker.weaponSkill}, S ${attacker.strength}, A ${attacker.attacks}.`);
  }

  // Target
  const target: Partial<HeresyAttackInput> = {};
  /** Target stats that apply to Shooting Attacks only (an ion shield's save). */
  const vsShooting: Partial<HeresyAttackInput> = {};
  let locations: Location[] = [];
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
      const a = armourValues(m.unit, r, notes);
      if (a.error || !a.locations.length) return { attacks: [], notes, error: a.error ?? `No armour value found for "${m.unit.name}".` };
      locations = a.locations;
      target.targetArmour = a.locations[0].av;
      const ws = num(vehicleAsModel(m.unit)?.weaponSkill);
      if (ws !== undefined) target.targetWeaponSkill = ws; // Knights fight back with a WS
      notes.push(`Target: ${m.unit.name}${a.locations.length === 1 ? `, ${a.locations[0].label}` : ""}.`);
      const titan = ruleValue(m.unit.specialRules, /^titan void shield array\s*\((\d+)\)/i);
      const voids = ruleValue(m.unit.specialRules, /^void shields\s*\((\d+)\)/i);
      if (titan !== undefined || voids !== undefined) {
        const up = r.shieldsUp ?? titan ?? voids!;
        if (titan !== undefined) target.titanVoidShields = up;
        else target.voidShields = up;
        notes.push(`${titan !== undefined ? "Titan Void Shield Array" : "Void Shields"}: ${up} up${r.shieldsUp === undefined ? " (all of them; say how many are left if some are down)" : ""}. Shields only stop Shooting Attacks.`);
      }
      const ion = ionShield(m.unit);
      if (ion) {
        const facing = (r.facing ?? "front").toLowerCase();
        vsShooting.invulnerableSave = facing === "rear" ? 6 : 5;
        if (ion.flare) target.noArmourbane = true;
        notes.push(`${ion.name}: ${facing === "rear" ? "6+" : "5+"} Invulnerable Save against Shooting at this facing, also against Glancing Hits${ion.flare ? "; no Armourbane" : ""}. Not against melee.`);
      }
    }
  }

  const base = (extra: Partial<HeresyAttackInput>): HeresyAttackInput => {
    // Numbers given explicitly always win over looked-up ones.
    const defined = Object.fromEntries(
      Object.entries(r).filter(([k, v]) => v !== undefined && !["weapon", "target", "attacker", "firingModels", "facing", "location", "crippled", "shieldsUp"].includes(k)),
    );
    const shooting = (extra.attackType ?? r.attackType ?? "ranged") === "ranged" ? vsShooting : {};
    return { attackType: "ranged", attacks: 1, strength: 4, damage: "1", ...target, ...shooting, ...extra, ...defined } as HeresyAttackInput;
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
  return { attacks: perLocation(attacks, locations, attackerKnight, notes), notes };
}

/**
 * One result per Titan or Ordinatus profile targeted, with the Titan targeting rules: Shooting at the
 * Head is Snap Shots; Template weapons may only hit the Legs; in a Combat only Knights and Antigrav
 * models may attack anything but the Legs, hitting against WS 1 (WS 4 at the Head).
 */
function perLocation(attacks: ResolvedAttack[], locations: Location[], attackerKnight: boolean, notes: string[]): ResolvedAttack[] {
  if (!locations.length || !locations[0].name) return attacks;
  const out: ResolvedAttack[] = [];
  for (const a of attacks) {
    const melee = a.input.attackType === "melee";
    const template = !melee && (a.input.specialRules ?? []).some((r) => /^template/i.test(r));
    let locs = locations;
    if (locations[0].titan && ((melee && !attackerKnight) || template)) {
      const legs = locations.filter((l) => /leg/i.test(l.name));
      if (legs.length) {
        if (locations.some((l) => !/leg/i.test(l.name))) {
          notes.push(melee ? "In a Combat only Knights and Antigrav models may attack anything but a Titan's Legs." : "Template weapons may only hit a Titan's Legs.");
        }
        locs = legs;
      }
    }
    for (const l of locs) {
      const head = /head/i.test(l.name);
      const input: HeresyAttackInput = { ...a.input, targetArmour: l.av, ...(l.titan ? { titan: l.crippled ? ("crippled" as const) : ("intact" as const) } : {}) };
      if (l.titan && !melee && head) input.snapShots = true;
      if (l.titan && melee) input.targetWeaponSkill = head ? 4 : 1;
      out.push({ label: [a.label, locs.length > 1 || locations.length > 1 ? l.label : ""].filter(Boolean).join(" → "), input });
    }
  }
  return out;
}
