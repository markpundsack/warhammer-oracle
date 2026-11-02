import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { calculateHeresyAttack, type HeresyAttackInput, type Target } from "../lib/heresy-attack.js";
import { heresyStamp } from "../lib/heresy-format.js";

function targetText(t: Target): string {
  if (t === "auto") return "automatic";
  if (t === null) return "impossible";
  return `${t}+`;
}

function n(x: number): string {
  return x >= 10 ? x.toFixed(1) : x.toFixed(2).replace(/0$/, "");
}

export function formatHeresyAttack(i: HeresyAttackInput): string {
  const r = calculateHeresyAttack(i);
  const lines: string[] = [heresyStamp(), "# Horus Heresy attack"];
  const hitHow =
    i.attackType === "ranged"
      ? `BS ${i.ballisticSkill ?? 4}${i.snapShots ? " (Snap Shots)" : ""}`
      : `WS ${i.weaponSkill ?? 4} vs WS ${i.targetWeaponSkill ?? 4}`;
  const crit =
    r.criticalOn !== null && r.criticalHits > 0
      ? `, ${n(r.criticalHits)} of them Critical Hits (${r.hitTarget === "auto" ? "every hit" : `on ${r.criticalOn}+`})`
      : "";
  lines.push(`- **Hit Tests:** ${i.attacks} dice, ${hitHow} → ${targetText(r.hitTarget)} → **${n(r.hits)} hits**${crit}`);

  const saveText = (s: { target: number | null; kind: string }) => (s.target === null ? "no save" : `${s.kind} ${s.target}+`);
  if (i.targetArmour !== undefined) {
    lines.push(
      `- **Armour Penetration:** D6 + S${i.strength} vs Armour ${i.targetArmour} → **${n(r.penetrating!)} Penetrating**, **${n(r.glancing!)} Glancing**`,
    );
    lines.push(`- **Saves:** vs Penetrating: ${saveText(r.penSave!)} (no Armour Tests against Penetrating Hits); vs Glancing: ${saveText(r.save)}`);
    lines.push(
      `- **Result:** about **${n(r.expectedDamage)} Hull Points** lost from ${n(r.unsaved)} unsaved Penetrating Hits (Damage ${i.damage}), ` +
        `plus ${n(r.unsavedGlancing!)} Glancing Hits, each a roll on the Vehicle Damage Table.`,
    );
  } else {
    lines.push(`- **Wound Tests:** S${i.strength} vs T${i.toughness ?? 4} → ${targetText(r.woundTarget!)} → **${n(r.wounds!)} wounds**`);
    const apNote = i.ap === undefined ? "AP -" : `AP ${i.ap}`;
    lines.push(
      `- **Saves:** best available: ${saveText(r.save)} (${apNote}${i.armourSave !== undefined && i.ap !== undefined && i.ap <= i.armourSave ? `, which denies the ${i.armourSave}+ Armour Save` : ""})` +
        (i.damageMitigation ? `, then Damage Mitigation ${i.damageMitigation}+` : ""),
    );
    const killed = r.modelsKilled !== undefined ? `, about **${n(r.modelsKilled)} models** with ${i.woundsPerModel} Wound${i.woundsPerModel === 1 ? "" : "s"} each` : "";
    lines.push(`- **Result:** **${n(r.unsaved)} unsaved wounds** × Damage ${i.damage} = about **${n(r.expectedDamage)} damage**${killed}.`);
  }
  lines.push(
    "",
    "_Expected values. Not modelled: special rules (Rending, Breaching, Critical Hit effects, Shred, …), characteristic modifiers and re-rolls. " +
      "Melee Strength is the bearer's Strength after the weapon's modifier._",
  );
  return lines.join("\n");
}

export function registerHeresyAttackCalculator(server: McpServer): void {
  server.tool(
    "heresy_attack_calculator",
    "Horus Heresy (3rd edition) attack maths: expected hits, wounds (or Armour Penetration against a vehicle facing), saves and damage, " +
      "using the Heresy Ranged Hit Table (BS), Melee Hit Table (WS vs WS) and Wound Table (S vs T). Use this, not wound_calculator, for Heresy.",
    {
      attack_type: z.enum(["ranged", "melee"]).describe("Shooting Attack ('ranged') or melee ('melee')"),
      attacks: z.number().min(1).describe("Number of Hit Test dice: Firepower × firing models (ranged), or Attacks × models (melee)"),
      ballistic_skill: z.number().min(1).max(12).optional().describe("Ranged: the firer's BS (default 4)"),
      snap_shots: z.boolean().optional().describe("Ranged: the attack is made as Snap Shots"),
      weapon_skill: z.number().min(1).max(12).optional().describe("Melee: the attacker's WS (default 4)"),
      target_weapon_skill: z.number().min(1).max(12).optional().describe("Melee: the defender's WS (default 4)"),
      strength: z
        .number()
        .min(1)
        .describe("Strength of the hits: ranged = the weapon's RS; melee = the bearer's S after the weapon's modifier (S4 with 'user +4' = 8)"),
      toughness: z.number().min(1).optional().describe("Target's Toughness (non-vehicle targets; default 4)"),
      target_armour: z
        .number()
        .min(1)
        .optional()
        .describe("Vehicle target: the Armour Value of the facing hit (uses Armour Penetration Tests instead of Wound Tests)"),
      ap: z.number().min(1).max(6).optional().describe("The weapon's AP value (omit for AP '-'). An AP equal to or lower than the target's SAV number denies the Armour Save (AP 3 denies 3+ and 4+, not 2+)"),
      damage: z.string().describe("Damage value (e.g. '1', '2', 'D3')"),
      armour_save: z.number().min(2).max(6).optional().describe("Target's SAV as a number (3 for 3+); omit for '-'"),
      invulnerable_save: z.number().min(2).max(6).optional().describe("Target's INV as a number; omit for '-'"),
      cover_save: z.number().min(2).max(6).optional().describe("Cover Save from terrain or rules (ranged only)"),
      damage_mitigation: z.number().min(2).max(6).optional().describe("A Damage Mitigation Test (e.g. Feel No Pain (5+) → 5)"),
      wounds_per_model: z.number().min(1).optional().describe("Target's Wounds characteristic, for an estimate of models removed"),
    },
    async (a) => {
      const text = formatHeresyAttack({
        attackType: a.attack_type,
        attacks: a.attacks,
        ballisticSkill: a.ballistic_skill,
        snapShots: a.snap_shots,
        weaponSkill: a.weapon_skill,
        targetWeaponSkill: a.target_weapon_skill,
        strength: a.strength,
        toughness: a.toughness,
        targetArmour: a.target_armour,
        ap: a.ap,
        damage: a.damage,
        armourSave: a.armour_save,
        invulnerableSave: a.invulnerable_save,
        coverSave: a.cover_save,
        damageMitigation: a.damage_mitigation,
        woundsPerModel: a.wounds_per_model,
      });
      return { content: [{ type: "text" as const, text }] };
    },
  );
}
