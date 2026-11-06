import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { calculateHeresyAttack, type HeresyAttackInput, type Target } from "../lib/heresy-attack.js";
import { resolveHeresyAttack, type AttackRequest } from "../lib/heresy-attack-resolve.js";
import { heresyStamp } from "../lib/heresy-format.js";

function targetText(t: Target): string {
  if (t === "auto") return "automatic";
  if (t === null) return "impossible";
  return `${t}+`;
}

function n(x: number): string {
  return x >= 10 ? x.toFixed(1) : x.toFixed(2).replace(/0$/, "");
}

/** A count for reading aloud, with its noun: "about 1 model", "about 3.3 models", "almost no models"; never "0.44 models". */
function spokenCount(x: number, singular: string, plural = `${singular}s`): string {
  if (x < 0.05) return `almost no ${plural}`;
  const whole = Math.round(x);
  if (whole >= 1 && (Math.abs(x - whole) <= 0.15 || x >= 10)) return `about ${whole} ${whole === 1 ? singular : plural}`;
  return `about ${x.toFixed(1)} ${plural}`;
}

function percent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** The result in one speakable sentence: odds as percentages for a single die, rounded counts otherwise. */
export function spokenAnswer(i: HeresyAttackInput): string {
  const r = calculateHeresyAttack(i);
  if (i.targetArmour !== undefined) {
    const pen = r.penetrating ?? 0;
    const glance = r.glancing ?? 0;
    if (i.attacks === 1) {
      const g = glance > 0 ? `, and a ${percent(glance)} chance of a Glancing Hit` : ", and no Glancing Hits";
      return pen > 0 ? `A ${percent(pen)} chance of a Penetrating Hit${g}.` : `No chance of a Penetrating Hit${g}.`;
    }
    return `${spokenCount(pen, "Penetrating Hit")} and ${spokenCount(glance, "Glancing Hit")}.`.replace(/^./, (c) => c.toUpperCase());
  }
  const damage = spokenCount(r.expectedDamage, "point of damage", "points of damage");
  let text = damage;
  if (r.modelsKilled !== undefined) {
    const killed = `${spokenCount(r.modelsKilled, "model")} killed`;
    // Multi-Wound targets lose Wounds without dying, and Damage over a model's Wounds is lost: give both when they differ.
    text = Math.abs(r.expectedDamage - r.modelsKilled) < 0.15 ? killed : `${killed} (${damage} before overkill or spread across models)`;
  }
  return `${text}.`.replace(/^./, (c) => c.toUpperCase());
}

export function formatHeresyAttack(i: HeresyAttackInput): string {
  const r = calculateHeresyAttack(i);
  const lines: string[] = [heresyStamp(), "# Horus Heresy attack", `**Answer:** ${spokenAnswer(i)}`, ""];
  const hitHow =
    i.attackType === "ranged"
      ? `BS ${i.ballisticSkill ?? 4}${i.snapShots ? " (Snap Shots)" : ""}`
      : `WS ${i.weaponSkill ?? 4} vs WS ${i.targetWeaponSkill ?? 4}`;
  const special: string[] = [];
  if (r.criticalHits > 0) special.push(`${n(r.criticalHits)} Critical Hits (${r.hitTarget === "auto" ? "every hit" : `on ${r.criticalOn}+`}: wound automatically, +1 Damage)`);
  if (r.rendingHits > 0) special.push(`${n(r.rendingHits)} Rending Hits (on ${r.rules.rending}+: wound automatically)`);
  lines.push(
    `- **Hit Tests:** ${i.attacks} dice, ${hitHow} → ${targetText(r.hitTarget)} → **${n(r.hits)} hits**${special.length ? `, including ${special.join(" and ")}` : ""}`,
  );

  const saveText = (s: { target: number | null; kind: string }) => (s.target === null ? "no save" : `${s.kind} ${s.target}+`);
  if (i.targetArmour !== undefined) {
    lines.push(
      `- **Armour Penetration:** D6 + S${i.strength} vs Armour ${i.targetArmour} → **${n(r.penetrating!)} Penetrating**, **${n(r.glancing!)} Glancing**` +
        (r.rules.armourbane ? " (Armourbane: Glancing results count as Penetrating)" : ""),
    );
    lines.push(`- **Saves:** vs Penetrating: ${saveText(r.penSave!)} (no Armour Tests against Penetrating Hits); vs Glancing: ${saveText(r.save)}`);
    lines.push(
      `- **Result:** about **${n(r.expectedDamage)} Hull Points** lost from ${n(r.unsaved)} unsaved Penetrating Hits (Damage ${i.damage}), ` +
        `plus ${n(r.unsavedGlancing!)} Glancing Hits, each a roll on the Vehicle Damage Table.`,
    );
  } else {
    const woundExtras: string[] = [];
    if (r.breachingWounds > 0) woundExtras.push(`${n(r.breachingWounds)} Breaching (AP 2, on ${r.rules.breaching}+)`);
    if (r.rules.shred !== undefined) woundExtras.push(`Shred (+1 Damage on ${r.rules.shred}+)`);
    lines.push(
      `- **Wound Tests:** S${i.strength} vs T${i.toughness ?? 4} → ${targetText(r.woundTarget!)} → **${n(r.wounds!)} wounds**` +
        (woundExtras.length ? `, ${woundExtras.join("; ")}` : ""),
    );
    const apNote = i.ap === undefined ? "AP -" : `AP ${i.ap}`;
    lines.push(
      `- **Saves:** best available: ${saveText(r.save)} (${apNote}${i.armourSave !== undefined && i.ap !== undefined && i.ap <= i.armourSave ? `, which denies the ${i.armourSave}+ Armour Save` : ""})` +
        (i.damageMitigation ? `, then Damage Mitigation ${i.damageMitigation}+` : ""),
    );
    const killed = r.modelsKilled !== undefined ? `, about **${n(r.modelsKilled)} models** with ${i.woundsPerModel} Wound${i.woundsPerModel === 1 ? "" : "s"} each` : "";
    const dmgText = r.bonusDamageWounds > 0 ? `Damage ${i.damage}, some +1` : `Damage ${i.damage}`;
    lines.push(`- **Result:** **${n(r.unsaved)} unsaved wounds** (${dmgText}) = about **${n(r.expectedDamage)} damage**${killed}.`);
  }
  const ignored = r.rules.ignored.length ? `the weapon's ${r.rules.ignored.join(", ")}; ` : "";
  lines.push(
    "",
    "_Expected values. Modelled: Rending, Critical Hit, Breaching, Shred, Armourbane (when listed in special_rules). " +
      `Not modelled: ${ignored}other special rules, characteristic modifiers and re-rolls. Melee Strength is the bearer's Strength after the weapon's modifier._`,
  );
  return lines.join("\n");
}

export function formatResolvedAttack(req: AttackRequest): string {
  const { attacks, notes, error } = resolveHeresyAttack(req);
  if (error) return `${heresyStamp()}\n\n${error}`;
  const head = notes.length ? `\n\n_${notes.join(" ")}_` : "";
  if (attacks.length === 1) {
    return formatHeresyAttack(attacks[0].input).replace("# Horus Heresy attack\n", `# Horus Heresy attack${head}\n\n`);
  }
  // Several profiles: the answers up front, so a voice reply can name them or ask which.
  const answers = attacks.map((a) => `- **${a.label}:** ${spokenAnswer(a.input)}`).join("\n");
  const details = attacks.map((a) => `## ${a.label}\n\n${formatHeresyAttack(a.input).split("\n").slice(3).join("\n").trim()}`).join("\n\n");
  return `${heresyStamp()}\n\n# Horus Heresy attack${head}\n\n**Answer, by weapon profile:**\n${answers}\n\n${details}`;
}

export function registerHeresyAttackCalculator(server: McpServer): void {
  server.tool(
    "heresy_attack_calculator",
    "Horus Heresy (3rd edition) attack maths: expected hits, wounds (or Armour Penetration against a vehicle facing), saves and damage. " +
      "Call it directly with the weapon and target NAMES: it looks up their stats, so no lookup_unit or lookup_weapon first. " +
      "Speak the Answer line. Use this, not wound_calculator, for Heresy.",
    {
      weapon: z.string().optional().describe("Weapon name, e.g. 'bolter', 'power fist'. Its stats and special rules are looked up for you; a weapon with several profiles gets a result for each"),
      target: z.string().optional().describe("Target unit or model name, e.g. 'Legionaries', 'Rhino'. Its Toughness or Armour, saves and Wounds are looked up for you"),
      attacker: z.string().optional().describe("Firing or attacking unit or model, if the querent named one. Omitted: BS/WS 4, Strength 4, and the answer says so"),
      facing: z.enum(["front", "side", "rear"]).optional().describe("Vehicle target's facing (default front)"),
      firing_models: z.number().min(1).optional().describe("How many models attack, when the querent gives models, not shots ('five bolters')"),
      attack_type: z.enum(["ranged", "melee"]).optional().describe("Shooting Attack ('ranged') or melee ('melee'); only needed for a weapon with both"),
      attacks: z.number().min(1).optional().describe("Number of Hit Test dice, when the querent gives shots ('ten shots')"),
      ballistic_skill: z.number().min(1).max(12).optional().describe("Ranged: the firer's BS (default 4)"),
      snap_shots: z.boolean().optional().describe("Ranged: the attack is made as Snap Shots"),
      weapon_skill: z.number().min(1).max(12).optional().describe("Melee: the attacker's WS (default 4)"),
      target_weapon_skill: z.number().min(1).max(12).optional().describe("Melee: the defender's WS (default 4)"),
      strength: z
        .number()
        .min(1)
        .optional()
        .describe("Strength of the hits: ranged = the weapon's RS; melee = the bearer's S after the weapon's modifier (S4 with 'user +4' = 8)"),
      toughness: z.number().min(1).optional().describe("Target's Toughness (non-vehicle targets; default 4)"),
      target_armour: z
        .number()
        .min(1)
        .optional()
        .describe("Vehicle target: the Armour Value of the facing hit (uses Armour Penetration Tests instead of Wound Tests)"),
      ap: z.number().min(1).max(6).optional().describe("The weapon's AP value (omit for AP '-'). An AP equal to or lower than the target's SAV number denies the Armour Save (AP 3 denies 3+ and 4+, not 2+)"),
      damage: z.string().optional().describe("Damage value (e.g. '1', '2', 'D3'); looked up when a weapon is named"),
      armour_save: z.number().min(2).max(6).optional().describe("Target's SAV as a number (3 for 3+); omit for '-'"),
      invulnerable_save: z.number().min(2).max(6).optional().describe("Target's INV as a number; omit for '-'"),
      cover_save: z.number().min(2).max(6).optional().describe("Cover Save from terrain or rules (ranged only)"),
      damage_mitigation: z.number().min(2).max(6).optional().describe("A Damage Mitigation Test (e.g. Feel No Pain (5+) → 5)"),
      wounds_per_model: z.number().min(1).optional().describe("Target's Wounds characteristic, for an estimate of models removed"),
      special_rules: z
        .array(z.string())
        .optional()
        .describe(
          "The weapon's special rules exactly as its profile lists them, e.g. ['Breaching (6+)', 'Heavy (FP)']. " +
            "Rending (X), Critical Hit (X), Breaching (X), Shred (X) and Armourbane are modelled; others are named as not modelled.",
        ),
    },
    async (a) => {
      const req: AttackRequest = {
        weapon: a.weapon,
        target: a.target,
        attacker: a.attacker,
        facing: a.facing,
        firingModels: a.firing_models,
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
        specialRules: a.special_rules,
      };
      const text = formatResolvedAttack(req);
      return { content: [{ type: "text" as const, text }] };
    },
  );
}
