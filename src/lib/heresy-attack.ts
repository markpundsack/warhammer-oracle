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

// === Weapon special rules that change the maths ===

/** The special rules the calculator models, read from a weapon's rule list ("Rending (6+)", "Breaching (5+)", "Armourbane"). */
export type ModelledRules = {
  rending?: number;
  criticalHit?: number;
  breaching?: number;
  shred?: number;
  armourbane?: boolean;
  /** Shield-breaker (X): collapses X void shields instead of 1. */
  shieldBreaker?: number;
  /** Rules given but not modelled (Template, Heavy, Pinning, …), for the "not modelled" note. */
  ignored: string[];
};

export function parseWeaponRules(rules: string[] = []): ModelledRules {
  const out: ModelledRules = { ignored: [] };
  for (const raw of rules) {
    const r = raw.trim();
    const sb = r.match(/^shield-?breaker\s*\(\s*(\d+)\s*\)$/i);
    if (sb) {
      out.shieldBreaker = Number(sb[1]);
      continue;
    }
    const m = r.match(/^(rending|critical hit|breaching|shred)\s*\(\s*(\d)\s*\+?\s*\)$/i);
    if (m) {
      const key = m[1].toLowerCase();
      const x = Number(m[2]);
      if (key === "rending") out.rending = x;
      else if (key === "critical hit") out.criticalHit = x;
      else if (key === "breaching") out.breaching = x;
      else out.shred = x;
    } else if (/^armourbane$/i.test(r)) out.armourbane = true;
    else if (r) out.ignored.push(r);
  }
  return out;
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
  /** The weapon's special rules as listed on its profile, e.g. ["Breaching (6+)", "Heavy (FP)"]. */
  specialRules?: string[];
  /** Void Shields (X) still up: each Penetrating Hit from a Shooting Attack is reduced to Damage 0 and takes one down. */
  voidShields?: number;
  /** Titan Void Shield Array (X) still up: every Shooting hit goes to a shield first (Armour 13; a Glancing or Penetrating Hit collapses it). */
  titanVoidShields?: number;
  /** A flare shield: no Armourbane against this target. */
  noArmourbane?: boolean;
};

export type HeresyAttackResult = {
  hitTarget: Target;
  criticalOn: number | null;
  hits: number;
  criticalHits: number;
  /** Rending Hits (auto-wound), non-vehicle targets only. */
  rendingHits: number;
  /** Wounds that became AP 2 through Breaching (X). */
  breachingWounds: number;
  /** Wounds with +1 Damage from Shred (X) or a Critical Hit. */
  bonusDamageWounds: number;
  rules: ModelledRules;
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
  /** Void shields: how many were up, how many the attack is expected to collapse, and the share of hits (or Penetrating Hits) that got past them. */
  shields?: { kind: "void" | "titan"; up: number; collapsed: number; throughShare: number };
};

/**
 * Expected value of a sequence of `dice` attack dice against `up` shields. Each die
 * collapses `perCollapse` shields with probability `pCollapse` while any are up; once
 * none are, it gets through with probability `pPass`. Returns the expected number of
 * dice that got through and of shields collapsed.
 */
export function throughShields(dice: number, up: number, pCollapse: number, pPass: number, perCollapse = 1): { through: number; collapsed: number } {
  let dist = new Array(up + 1).fill(0); // dist[k]: chance that k shields are still up
  dist[up] = 1;
  let through = 0;
  const whole = Math.floor(dice);
  const step = (weight: number) => {
    const next = new Array(up + 1).fill(0);
    through += dist[0] * pPass * weight;
    next[0] += dist[0];
    for (let k = 1; k <= up; k++) {
      const c = pCollapse * weight;
      next[Math.max(0, k - perCollapse)] += dist[k] * c;
      next[k] += dist[k] * (1 - c);
    }
    dist = next;
  };
  for (let d = 0; d < whole; d++) step(1);
  if (dice > whole) step(dice - whole); // a fractional die (an average Firepower) counts in proportion
  const remaining = dist.reduce((a, p, k) => a + p * k, 0);
  return { through, collapsed: up - remaining };
}

const D6 = [1, 2, 3, 4, 5, 6];

function rolls(t: Target, d: number): boolean {
  return t === "auto" || (t !== null && d >= Math.max(t, 2));
}

export function calculateHeresyAttack(i: HeresyAttackInput): HeresyAttackResult {
  const rules = parseWeaponRules(i.specialRules);
  let hitTarget: Target;
  let criticalOn: number | null = null;
  if (i.attackType === "ranged") {
    const r = rangedHitTarget(i.ballisticSkill ?? 4, i.snapShots);
    hitTarget = r.target;
    criticalOn = r.criticalOn;
  } else {
    hitTarget = meleeHitTarget(i.weaponSkill ?? 4, i.targetWeaponSkill ?? 4);
  }
  const vehicle = i.targetArmour !== undefined;
  // The weapon's own Critical Hit (X) and the table's CX+ both apply; the lower X wins.
  const critX = [criticalOn, rules.criticalHit].filter((x): x is number => x != null).reduce<number | null>((a, b) => (a === null ? b : Math.min(a, b)), null);
  const averageDamage = parseDamage(i.damage);
  const saveFor = (ap: number | undefined, opts: { penetratingHit?: boolean } = {}) =>
    bestSave({ armourSave: i.armourSave, invulnerableSave: i.invulnerableSave, coverSave: i.coverSave, ap, ranged: i.attackType === "ranged" }, opts);
  const mitigateP = i.damageMitigation ? 1 - pSuccess(i.damageMitigation) : 1;

  // Per Hit Test die: the share that is a plain hit, a Critical Hit or a Rending Hit. "Automatic" counts as a natural 6.
  let plain = 0, crit = 0, rend = 0;
  for (const d of hitTarget === "auto" ? [6] : D6) {
    const w = hitTarget === "auto" ? 1 : 1 / 6;
    if (!rolls(hitTarget, d)) continue;
    if (hitTarget === "auto" || (critX !== null && d >= critX)) crit += w;
    else if (!vehicle && rules.rending !== undefined && d >= rules.rending) rend += w;
    else plain += w;
  }
  const n = i.attacks;
  const hits = n * (plain + crit + rend);

  if (vehicle) {
    // Rending and Shred do nothing against vehicles; a Critical Hit's auto-wound is a Wound Test rule, so its hits
    // still make Armour Penetration Tests here (the +1 Damage is kept).
    const { glance, pen } = penetration(i.strength, i.targetArmour!);
    const armourbane = rules.armourbane && !i.noArmourbane;
    const glanceP = armourbane ? 0 : glance;
    const penP = armourbane ? glance + pen : pen;
    const ranged = i.attackType === "ranged";
    const hitP = plain + crit + rend;
    // Void shields only stop Shooting Attacks. A titan's take every hit first; a Void Shields (X) model's only Penetrating Hits.
    let glanceShare = 1, penShare = 1;
    let shields: HeresyAttackResult["shields"];
    const per = rules.shieldBreaker ?? 1;
    if (ranged && i.titanVoidShields && hitP > 0) {
      const v = penetration(i.strength, 13);
      const t = throughShields(n, i.titanVoidShields, hitP * (v.glance + v.pen), hitP, per);
      glanceShare = penShare = t.through / (n * hitP);
      shields = { kind: "titan", up: i.titanVoidShields, collapsed: t.collapsed, throughShare: glanceShare };
    } else if (ranged && i.voidShields && hitP * penP > 0) {
      const t = throughShields(n, i.voidShields, hitP * penP, hitP * penP, per);
      penShare = t.through / (n * hitP * penP);
      shields = { kind: "void", up: i.voidShields, collapsed: t.collapsed, throughShare: penShare };
    }
    const glancing = hits * glanceP * glanceShare;
    const penetrating = hits * penP * penShare;
    const save = saveFor(i.ap);
    const penSave = saveFor(i.ap, { penetratingHit: true });
    const penKeep = (1 - pSuccess(penSave.target)) * mitigateP;
    const unsaved = penetrating * penKeep;
    const critPens = n * crit * penP * penShare * penKeep;
    const unsavedGlancing = glancing * (1 - pSuccess(save.target)) * mitigateP;
    return {
      hitTarget, criticalOn: critX, hits, criticalHits: n * crit, rendingHits: 0, breachingWounds: 0, bonusDamageWounds: critPens, rules,
      glancing, penetrating, save, penSave, unsaved, unsavedGlancing, averageDamage,
      expectedDamage: unsaved * averageDamage + critPens,
      ...(shields ? { shields } : {}),
    };
  }

  // Wounds by (AP used, +Damage): plain hits roll to wound; Critical and Rending Hits wound automatically, counting as a 6.
  const wTarget = woundTarget(i.strength, i.toughness ?? 4);
  type Bucket = { ap: number | undefined; bonus: number; count: number };
  const buckets: Bucket[] = [];
  const add = (count: number, breach: boolean, bonus: number) => {
    if (count <= 0) return;
    const ap = breach ? Math.min(2, i.ap ?? 2) : i.ap;
    const b = buckets.find((x) => x.ap === ap && x.bonus === bonus);
    if (b) b.count += count;
    else buckets.push({ ap, bonus, count });
  };
  for (const w of D6) {
    if (!rolls(wTarget, w)) continue;
    add((n * plain) / 6, rules.breaching !== undefined && w >= rules.breaching, rules.shred !== undefined && w >= rules.shred ? 1 : 0);
  }
  const autoBreach = rules.breaching !== undefined; // counts as a 6
  const autoShred = rules.shred !== undefined ? 1 : 0;
  add(n * crit, autoBreach, 1 + autoShred);
  add(n * rend, autoBreach, autoShred);

  const wounds = buckets.reduce((a, b) => a + b.count, 0);
  let unsaved = 0, expectedDamage = 0, killed = 0, breachingWounds = 0, bonusDamageWounds = 0;
  for (const b of buckets) {
    if (b.ap !== i.ap) breachingWounds += b.count;
    if (b.bonus) bonusDamageWounds += b.count;
    const keep = b.count * (1 - pSuccess(saveFor(b.ap).target)) * mitigateP;
    const dmg = averageDamage + b.bonus;
    unsaved += keep;
    expectedDamage += keep * dmg;
    // Damage never carries over to another model: a wound kills at most one model.
    if (i.woundsPerModel) killed += keep * Math.min(dmg / i.woundsPerModel, 1);
  }
  return {
    hitTarget, criticalOn: critX, hits, criticalHits: n * crit, rendingHits: n * rend, breachingWounds, bonusDamageWounds, rules,
    woundTarget: wTarget, wounds, save: saveFor(i.ap), unsaved, averageDamage, expectedDamage,
    modelsKilled: i.woundsPerModel ? killed : undefined,
  };
}
