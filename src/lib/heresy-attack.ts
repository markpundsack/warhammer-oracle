/**
 * Horus Heresy 3rd Edition attack maths: Hit Tests, Wound Tests or Armour
 * Penetration Tests, and Saving Throws, as expected values.
 *
 * Tables from the HH3 core rules (Principles of Combat, as hosted on
 * Wahapedia): the Ranged Hit Test Table (BS → target number, with the
 * Automatic and CX+ Critical Hit entries), the Melee Hit Table (attacker's
 * WS vs defender's WS) and the Wound Table (Strength vs Toughness). The two
 * charts are images on Wahapedia and were transcribed cell by cell; the Wound
 * Table reduces exactly to the S−T rule in `woundTarget`.
 *
 * Special rules (Rending, Breaching, Critical Hit effects, Shred, …),
 * modifiers and re-rolls are not modelled: the result says so.
 */
import { parseDamage } from "./wound-calc.js";

/** Target number 2–6, or "auto" (no roll, counts as a 6), or null (cannot succeed). */
export type Target = number | "auto" | null;

export function pSuccess(t: Target): number {
  if (t === "auto") return 1;
  if (t === null) return 0;
  return (7 - Math.min(Math.max(t, 2), 7)) / 6;
}

function clamp10(n: number): number {
  return Math.min(Math.max(Math.round(n), 1), 10);
}

// === Ranged Hit Test Table ===

/** BS 1..10+ → target; BS 6–9 hit on 2+ with a Critical Hit on X+ (C6+ … C3+); BS 10+ hits automatically (and critically). */
export function rangedHitTarget(bs: number, snapShots = false): { target: Target; criticalOn: number | null } {
  const b = clamp10(bs);
  if (snapShots) {
    const SNAP: Record<number, Target> = { 10: 2, 9: 3, 8: 3, 7: 4, 6: 4, 5: 5, 4: 5, 3: 6, 2: 6, 1: null };
    return { target: SNAP[b], criticalOn: null };
  }
  if (b >= 10) return { target: "auto", criticalOn: 1 };
  if (b >= 6) return { target: 2, criticalOn: 12 - b }; // 9 → C3+, 8 → C4+, 7 → C5+, 6 → C6+
  return { target: 7 - b, criticalOn: null }; // 5 → 2+ … 1 → 6+
}

// === Melee Hit Table (attacker's WS rows × defender's WS columns) ===

const MELEE_HIT: number[][] = [
  [4, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  [2, 4, 5, 6, 6, 6, 6, 6, 6, 6],
  [2, 3, 4, 5, 5, 6, 6, 6, 6, 6],
  [2, 2, 3, 4, 5, 5, 6, 6, 6, 6],
  [2, 2, 3, 3, 4, 5, 5, 5, 5, 6],
  [2, 2, 2, 3, 3, 4, 5, 5, 5, 5],
  [2, 2, 2, 3, 3, 3, 4, 5, 5, 5],
  [2, 2, 2, 2, 3, 3, 3, 4, 5, 5],
  [2, 2, 2, 2, 3, 3, 3, 3, 4, 5],
  [2, 2, 2, 2, 2, 3, 3, 3, 3, 4],
];

export function meleeHitTarget(attackerWs: number, defenderWs: number): Target {
  return MELEE_HIT[clamp10(attackerWs) - 1][clamp10(defenderWs) - 1];
}

// === Wound Table ===

/** S−T ≥ +2: 2+, +1: 3+, 0: 4+, −1: 5+, −2/−3: 6+, −4 or worse: cannot wound. */
export function woundTarget(strength: number, toughness: number): Target {
  const d = strength - toughness;
  if (d >= 2) return 2;
  if (d === 1) return 3;
  if (d === 0) return 4;
  if (d === -1) return 5;
  if (d >= -3) return 6;
  return null;
}

// === Armour Penetration (vehicles) ===

/** One D6 + Strength vs the facing's Armour Value: equal = Glancing Hit, greater = Penetrating Hit. */
export function penetration(strength: number, armour: number): { glance: number; pen: number } {
  const need = armour - strength; // the D6 roll that equals the Armour Value
  const glance = need >= 1 && need <= 6 ? 1 / 6 : 0;
  const pen = Math.min(Math.max(6 - Math.max(need, 0), 0), 6) / 6;
  return { glance, pen };
}

// === Saving Throws ===

export type SaveInput = {
  armourSave?: number; // 2..6 (the Target Number), omitted = "-"
  invulnerableSave?: number;
  coverSave?: number;
  ap?: number; // omitted = "-" (no effect on Armour Tests)
  ranged: boolean;
};

/**
 * The best single Saving Throw available against one wound (only one may be
 * made per wound): Armour unless the AP value is equal to or lower than the
 * Armour Save; Cover only against ranged attacks; Invulnerable always.
 */
export function bestSave(s: SaveInput, opts: { penetratingHit?: boolean } = {}): { target: number | null; kind: string } {
  const options: { target: number; kind: string }[] = [];
  const armourAllowed = s.armourSave !== undefined && !opts.penetratingHit && (s.ap === undefined || s.ap > s.armourSave);
  if (armourAllowed) options.push({ target: s.armourSave!, kind: "Armour" });
  if (s.invulnerableSave !== undefined) options.push({ target: s.invulnerableSave, kind: "Invulnerable" });
  if (s.coverSave !== undefined && s.ranged) options.push({ target: s.coverSave, kind: "Cover" });
  if (!options.length) return { target: null, kind: "none" };
  return options.sort((a, b) => a.target - b.target)[0];
}

// === Whole attack ===

export type HeresyAttackInput = {
  attackType: "ranged" | "melee";
  attacks: number;
  ballisticSkill?: number;
  snapShots?: boolean;
  weaponSkill?: number;
  targetWeaponSkill?: number;
  strength: number;
  toughness?: number;
  targetArmour?: number; // a vehicle facing's Armour Value: Armour Penetration Tests instead of Wound Tests
  ap?: number;
  damage: string;
  armourSave?: number;
  invulnerableSave?: number;
  coverSave?: number;
  damageMitigation?: number;
  woundsPerModel?: number;
};

export type HeresyAttackResult = {
  hitTarget: Target;
  criticalOn: number | null;
  hits: number;
  criticalHits: number;
  /** Wound Test target (non-vehicle). */
  woundTarget?: Target;
  wounds?: number;
  glancing?: number;
  penetrating?: number;
  save: { target: number | null; kind: string };
  /** Vehicles: the save allowed against Penetrating Hits (no Armour Tests). */
  penSave?: { target: number | null; kind: string };
  unsaved: number;
  unsavedGlancing?: number;
  averageDamage: number;
  expectedDamage: number;
  modelsKilled?: number;
};

export function calculateHeresyAttack(i: HeresyAttackInput): HeresyAttackResult {
  let hitTarget: Target;
  let criticalOn: number | null = null;
  if (i.attackType === "ranged") {
    const r = rangedHitTarget(i.ballisticSkill ?? 4, i.snapShots);
    hitTarget = r.target;
    criticalOn = r.criticalOn;
  } else {
    hitTarget = meleeHitTarget(i.weaponSkill ?? 4, i.targetWeaponSkill ?? 4);
  }
  const hits = i.attacks * pSuccess(hitTarget);
  const criticalHits = criticalOn === null ? 0 : i.attacks * (hitTarget === "auto" ? 1 : (7 - criticalOn) / 6);
  const averageDamage = parseDamage(i.damage);
  const saveIn: SaveInput = {
    armourSave: i.armourSave,
    invulnerableSave: i.invulnerableSave,
    coverSave: i.coverSave,
    ap: i.ap,
    ranged: i.attackType === "ranged",
  };
  const mitigate = (n: number) => (i.damageMitigation ? n * (1 - pSuccess(i.damageMitigation)) : n);

  if (i.targetArmour !== undefined) {
    const { glance, pen } = penetration(i.strength, i.targetArmour);
    const glancing = hits * glance;
    const penetrating = hits * pen;
    const save = bestSave(saveIn); // against Glancing Hits
    const penSave = bestSave(saveIn, { penetratingHit: true });
    const unsaved = mitigate(penetrating * (1 - pSuccess(penSave.target)));
    const unsavedGlancing = mitigate(glancing * (1 - pSuccess(save.target)));
    return {
      hitTarget, criticalOn, hits, criticalHits, glancing, penetrating, save, penSave,
      unsaved, unsavedGlancing, averageDamage, expectedDamage: unsaved * averageDamage,
    };
  }

  const wTarget = woundTarget(i.strength, i.toughness ?? 4);
  const wounds = hits * pSuccess(wTarget);
  const save = bestSave(saveIn);
  const unsaved = mitigate(wounds * (1 - pSuccess(save.target)));
  const expectedDamage = unsaved * averageDamage;
  // Damage never carries over to another model: a wound kills at most one model.
  const modelsKilled = i.woundsPerModel ? unsaved * Math.min(averageDamage / i.woundsPerModel, 1) : undefined;
  return { hitTarget, criticalOn, hits, criticalHits, woundTarget: wTarget, wounds, save, unsaved, averageDamage, expectedDamage, modelsKilled };
}
