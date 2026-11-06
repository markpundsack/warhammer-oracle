import { describe, it, expect } from "vitest";
import {
  bestSave,
  calculateHeresyAttack,
  meleeHitTarget,
  penetration,
  rangedHitTarget,
  woundTarget,
} from "../src/lib/heresy-attack.js";
import { formatHeresyAttack } from "../src/tools/heresy-attack-calculator.js";

describe("Heresy tables", () => {
  it("Wound Table: every cell of the published S vs T chart", () => {
    // rows S1..S10, columns T1..T10; 0 = '-' (cannot wound)
    const chart = [
      [4, 5, 6, 6, 0, 0, 0, 0, 0, 0],
      [3, 4, 5, 6, 6, 0, 0, 0, 0, 0],
      [2, 3, 4, 5, 6, 6, 0, 0, 0, 0],
      [2, 2, 3, 4, 5, 6, 6, 0, 0, 0],
      [2, 2, 2, 3, 4, 5, 6, 6, 0, 0],
      [2, 2, 2, 2, 3, 4, 5, 6, 6, 0],
      [2, 2, 2, 2, 2, 3, 4, 5, 6, 6],
      [2, 2, 2, 2, 2, 2, 3, 4, 5, 6],
      [2, 2, 2, 2, 2, 2, 2, 3, 4, 5],
      [2, 2, 2, 2, 2, 2, 2, 2, 3, 4],
    ];
    for (let s = 1; s <= 10; s++) {
      for (let t = 1; t <= 10; t++) {
        expect(woundTarget(s, t), `S${s} T${t}`).toBe(chart[s - 1][t - 1] || null);
      }
    }
  });

  it("Melee Hit Table: spot cells", () => {
    expect(meleeHitTarget(4, 4)).toBe(4);
    expect(meleeHitTarget(5, 4)).toBe(3);
    expect(meleeHitTarget(4, 5)).toBe(5);
    expect(meleeHitTarget(1, 2)).toBe(6);
    expect(meleeHitTarget(10, 1)).toBe(2);
    expect(meleeHitTarget(7, 10)).toBe(5);
  });

  it("Ranged Hit Table: numbers, CX+ criticals, Automatic, Snap Shots", () => {
    expect(rangedHitTarget(4)).toEqual({ target: 3, criticalOn: null });
    expect(rangedHitTarget(5)).toEqual({ target: 2, criticalOn: null });
    expect(rangedHitTarget(6)).toEqual({ target: 2, criticalOn: 6 });
    expect(rangedHitTarget(9)).toEqual({ target: 2, criticalOn: 3 });
    expect(rangedHitTarget(10).target).toBe("auto");
    expect(rangedHitTarget(4, true).target).toBe(5);
    expect(rangedHitTarget(1, true).target).toBeNull();
  });

  it("Armour Penetration: equal = glancing, greater = penetrating", () => {
    expect(penetration(8, 12)).toEqual({ glance: 1 / 6, pen: 2 / 6 }); // need 4: 4 glances, 5-6 pen
    expect(penetration(4, 12)).toEqual({ glance: 0, pen: 0 });
    expect(penetration(10, 10)).toEqual({ glance: 0, pen: 1 });
  });

  it("AP equal to or lower than the save denies Armour Tests; one best save", () => {
    expect(bestSave({ armourSave: 3, ap: 3, ranged: true })).toEqual({ target: null, kind: "none" });
    expect(bestSave({ armourSave: 3, ap: 4, ranged: true })).toEqual({ target: 3, kind: "Armour" });
    expect(bestSave({ armourSave: 2, ap: 3, invulnerableSave: 4, ranged: true })).toEqual({ target: 2, kind: "Armour" });
    expect(bestSave({ armourSave: 3, ap: 2, invulnerableSave: 5, ranged: false })).toEqual({ target: 5, kind: "Invulnerable" });
    expect(bestSave({ coverSave: 4, ranged: false })).toEqual({ target: null, kind: "none" }); // no cover in combat
  });
});

describe("calculateHeresyAttack", () => {
  it("10 bolter shots (BS4, S4, AP5) into T4 SAV3+ Legionaries", () => {
    const r = calculateHeresyAttack({ attackType: "ranged", attacks: 10, ballisticSkill: 4, strength: 4, toughness: 4, ap: 5, damage: "1", armourSave: 3, woundsPerModel: 1 });
    expect(r.hits).toBeCloseTo(10 * 4 / 6);
    expect(r.wounds).toBeCloseTo(10 * 4 / 6 * 3 / 6);
    expect(r.unsaved).toBeCloseTo(10 * 4 / 6 * 3 / 6 * 2 / 6);
    expect(r.modelsKilled).toBeCloseTo(r.unsaved);
  });

  it("power fist (S4 user +4 = S8, AP2, D2) against a Terminator (T5, 2+, 4++), WS4 vs WS4", () => {
    const r = calculateHeresyAttack({ attackType: "melee", attacks: 3, weaponSkill: 4, targetWeaponSkill: 4, strength: 8, toughness: 5, ap: 2, damage: "2", armourSave: 2, invulnerableSave: 4 });
    expect(r.hitTarget).toBe(4);
    expect(r.woundTarget).toBe(2);
    expect(r.save).toEqual({ target: 4, kind: "Invulnerable" });
    expect(r.expectedDamage).toBeCloseTo(3 * 0.5 * (5 / 6) * 0.5 * 2);
  });

  it("lascannon (S9) into Armour 12: penetrating hits ignore Armour Saves", () => {
    const r = calculateHeresyAttack({ attackType: "ranged", attacks: 1, ballisticSkill: 4, strength: 9, targetArmour: 12, ap: 2, damage: "1", armourSave: 3 });
    expect(r.penetrating).toBeCloseTo((4 / 6) * (3 / 6));
    expect(r.glancing).toBeCloseTo((4 / 6) * (1 / 6));
    expect(r.penSave).toEqual({ target: null, kind: "none" });
  });

  it("formats with the Heresy stamp and the not-modelled note", () => {
    const text = formatHeresyAttack({ attackType: "ranged", attacks: 10, ballisticSkill: 4, strength: 4, toughness: 4, ap: 5, damage: "1", armourSave: 3 });
    expect(text.startsWith("[Mode: Horus Heresy (3rd edition)]")).toBe(true);
    expect(text).toContain("3+ → **6.67 hits**".replace("6.67", "6.67"));
    expect(text).toContain("Not modelled");
  });
});

describe("calculateHeresyAttack: weapon special rules", () => {
  it("Rending (6+): natural 6s to hit wound automatically", () => {
    // WS4 vs WS4 hits on 4+: 4-5 plain (2/6), 6 Rending (1/6). Plain wounds 6·2/6·3/6 = 1; Rending 6·1/6 = 1. 3+ save (AP -).
    const r = calculateHeresyAttack({ attackType: "melee", attacks: 6, strength: 4, toughness: 4, damage: "1", armourSave: 3, specialRules: ["Rending (6+)"] });
    expect(r.rendingHits).toBeCloseTo(1);
    expect(r.wounds).toBeCloseTo(2);
    expect(r.unsaved).toBeCloseTo(2 * (2 / 6));
  });

  it("Breaching (5+): wound rolls of 5-6 are AP 2 and deny a 3+ save", () => {
    // BS4: 4 hits. Wound 4+: a 4 is AP5 (saved on 3+), 5-6 are AP2 (no save).
    const r = calculateHeresyAttack({ attackType: "ranged", attacks: 6, ballisticSkill: 4, strength: 4, toughness: 4, ap: 5, damage: "1", armourSave: 3, specialRules: ["Breaching (5+)"] });
    expect(r.breachingWounds).toBeCloseTo(4 * (2 / 6));
    expect(r.unsaved).toBeCloseTo(4 * (1 / 6) * (2 / 6) + 4 * (2 / 6));
  });

  it("Shred (6+): wound rolls of 6 do +1 Damage", () => {
    // BS5 hits on 2+: 5 hits. S5 vs T4 wounds on 3+: 3-5 normal, 6 Shred. No save.
    const r = calculateHeresyAttack({ attackType: "ranged", attacks: 6, ballisticSkill: 5, strength: 5, toughness: 4, damage: "1", specialRules: ["Shred (6+)"] });
    expect(r.expectedDamage).toBeCloseTo(5 * (3 / 6) * 1 + 5 * (1 / 6) * 2);
  });

  it("the table's C6+ at BS6: natural 6s are Critical Hits (auto-wound, +1 Damage)", () => {
    // 2-5 plain (4/6) wound T5 with S4 on 5+; the 6 (1/6) is a Critical Hit.
    const r = calculateHeresyAttack({ attackType: "ranged", attacks: 6, ballisticSkill: 6, strength: 4, toughness: 5, damage: "1" });
    expect(r.criticalHits).toBeCloseTo(1);
    expect(r.expectedDamage).toBeCloseTo(6 * (4 / 6) * (2 / 6) * 1 + 1 * 2);
  });

  it("Armourbane: Glancing results become Penetrating", () => {
    const plain = calculateHeresyAttack({ attackType: "ranged", attacks: 1, ballisticSkill: 4, strength: 9, targetArmour: 12, damage: "1" });
    const bane = calculateHeresyAttack({ attackType: "ranged", attacks: 1, ballisticSkill: 4, strength: 9, targetArmour: 12, damage: "1", specialRules: ["Heavy (D)", "Armourbane"] });
    expect(plain.penetrating).toBeCloseTo((4 / 6) * (3 / 6));
    expect(bane.penetrating).toBeCloseTo((4 / 6) * (4 / 6));
    expect(bane.glancing).toBe(0);
    expect(bane.rules.ignored).toEqual(["Heavy (D)"]);
  });

  it("names unmodelled rules in the output", () => {
    const text = formatHeresyAttack({ attackType: "ranged", attacks: 1, ballisticSkill: 4, strength: 9, targetArmour: 12, damage: "1", specialRules: ["Heavy (D)", "Armourbane"] });
    expect(text).toContain("Armourbane: Glancing results count as Penetrating");
    expect(text).toContain("Not modelled: the weapon's Heavy (D);");
  });
});
