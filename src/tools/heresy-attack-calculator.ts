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

/** "an 11%", "an 8%", "a 56%": the article as the number is spoken. */
function an(pct: string): string {
  return /^(8|11|18)(\D|$)|^8\d/.test(pct) ? `an ${pct}` : `a ${pct}`;
}

function cap(t: string): string {
  return t.replace(/^./, (c) => c.toUpperCase());
}

function percent(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** "6, doubled by Melta to 12" */
function dmgLabel(i: HeresyAttackInput, r: ReturnType<typeof calculateHeresyAttack>): string {
  if (!r.meltaDoubled) return i.damage;
  const d = Number(i.damage);
  return Number.isFinite(d) ? `${i.damage}, doubled by Melta to ${d * 2}` : `${i.damage}, doubled by Melta`;
}

/** A single shot's Damage per Penetrating Hit, for speech: "12", "D6" (Melta doubles it: "twice D6"). */
function perHitText(i: HeresyAttackInput, r: ReturnType<typeof calculateHeresyAttack>): string {
  const d = Number(i.damage);
  if (Number.isFinite(d)) return String(r.meltaDoubled ? d * 2 : d);
  return r.meltaDoubled ? `twice ${i.damage}` : i.damage;
}

/** "twice over", "three times over": only from 1.9 times (so never less than "twice"), to the nearest whole. */
function timesOver(times: number): string {
  if (times < 1.9) return "";
  const k = Math.round(times);
  return k === 2 ? " twice over" : ` ${["", "", "", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][k] ?? k} times over`;
}

/** ", enough to destroy it" (", … twice over") when the loss reaches the target's Hull Points. */
function overkill(lost: number, i: HeresyAttackInput): string {
  const hp = i.targetHullPoints;
  if (!hp || lost < hp) return "";
  return `, ${i.titan ? "enough to Cripple that profile" : "enough to destroy it"}${timesOver(lost / hp)}`;
}

/** The result in one speakable sentence: odds as percentages for a single die, rounded counts otherwise. */
export function spokenAnswer(i: HeresyAttackInput): string {
  const r = calculateHeresyAttack(i);
  if (i.targetArmour !== undefined) {
    const pen = r.penetrating ?? 0;
    const glance = r.glancing ?? 0;
    const sh = r.shields;
    const shieldText = sh
      ? `${sh.kind === "titan" ? "Collapses" : "Takes down"} ${spokenCount(sh.collapsed, "void shield")} of ${sh.up}` +
        (r.expectedDamage < 0.05 && glance < 0.05 ? ", and nothing gets through." : ", then ")
      : "";
    if (sh && r.expectedDamage < 0.05 && glance < 0.05) return shieldText.replace(/^./, (c) => c.toUpperCase());
    if (i.attacks === 1 && !sh && !i.titan) {
      // One shot: the chance and what a hit does; never an average (a Damage 6 hit takes 0 or 6, not 2.67).
      const g = glance > 0 ? `, and ${an(percent(glance))} chance of a Glancing Hit` : "";
      if (pen <= 0) return `No chance of a Penetrating Hit${g || ", and no Glancing Hits"}.`;
      const per = Number(perHitText(i, r));
      const kills = Number.isFinite(per) && i.targetHullPoints && per >= i.targetHullPoints ? `: ${overkill(per, i).slice(2)}` : "";
      return `${cap(an(percent(pen)))} chance of a Penetrating Hit, at ${perHitText(i, r)} Damage${kills}${g}.`;
    }
    const hp = r.titanCriticalRolls !== undefined
      ? `${spokenCount(r.titanCriticalRolls, "roll", "rolls")} on the Titan Critical Damage Table (the profile is Crippled)`
      : `${spokenCount(r.expectedDamage, "Hull Point")} lost${overkill(r.expectedDamage, i)}`;
    return `${shieldText}${spokenCount(pen, "Penetrating Hit")} and ${spokenCount(glance, "Glancing Hit")}: ${hp}.`.replace(/^./, (c) => c.toUpperCase());
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
  // Melta (X) against a vehicle, range not given: answer for both sides of X.
  const meltaX = i.targetArmour !== undefined && i.attackType === "ranged" && i.withinMeltaRange === undefined ? r.rules.melta : undefined;
  const answer = meltaX !== undefined
    ? `Beyond ${meltaX}": ${spokenAnswer(i)} Within ${meltaX}" (Melta: Armourbane, double Damage): ${spokenAnswer({ ...i, withinMeltaRange: true })}`
    : spokenAnswer(i);
  const lines: string[] = [heresyStamp(), "# Horus Heresy attack", `**Answer:** ${answer}`, ""];
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
        (r.rules.armourbane ? (i.noArmourbane ? " (Armourbane cancelled by the target's flare shield)" : " (Armourbane: Glancing results count as Penetrating)") : ""),
    );
    if (r.shields) {
      const what = r.shields.kind === "titan" ? "every hit goes to a void shield first (Armour 13; a Glancing or Penetrating Hit collapses it)" : "each Penetrating Hit is reduced to Damage 0 and takes a shield down";
      lines.push(
        `- **Void shields:** ${r.shields.up} up; ${what}${r.rules.shieldBreaker ? ` (Shield-breaker (${r.rules.shieldBreaker}): ${r.rules.shieldBreaker} per collapse)` : ""}. ` +
          `About **${n(r.shields.collapsed)} collapsed**; ${percent(r.shields.throughShare)} of ${r.shields.kind === "titan" ? "hits" : "Penetrating Hits"} get through (counted below).`,
      );
    }
    lines.push(`- **Saves:** vs Penetrating: ${saveText(r.penSave!)} (no Armour Tests against Penetrating Hits); vs Glancing: ${saveText(r.save)}`);
    if (r.titanCriticalRolls !== undefined) {
      lines.push(
        `- **Result:** the profile is Crippled: Glancing Hits count as Penetrating (Damage -1), and every hit that gets through is a roll on the Titan Critical Damage Table: ` +
          `about **${n(r.titanCriticalRolls)} rolls**. No Hull Points are lost.`,
      );
    } else if (r.titanGlanceHp !== undefined) {
      lines.push(
        `- **Result:** about **${n(r.expectedDamage)} Hull Points** lost: ${n(r.unsaved)} unsaved Penetrating Hits (Damage ${dmgLabel(i, r)}), ` +
          `plus ${n(r.unsavedGlancing!)} Glancing Hits on the Titan Damage Table (1-4 Armour Scar: 1 Hull Point; 5-6 System Burnout).`,
      );
    } else if (i.attacks === 1 && !r.shields) {
      // One shot: a hit does its Damage or nothing; the average is given as a per-shot rate, for players adding up several.
      lines.push(
        `- **Result:** ${percent(r.unsaved)} chance of an unsaved Penetrating Hit; each does ${perHitText(i, r)} Damage` +
          `${r.meltaDoubled ? ` (${i.damage}, doubled by Melta)` : ""}${i.targetHullPoints ? ` of its ${i.targetHullPoints} Hull Points` : ""}` +
          ` (averaged over many such shots: ${n(r.expectedDamage)} Hull Points each). ` +
          (r.unsavedGlancing! > 0.005 ? `${percent(r.unsavedGlancing!)} chance of a Glancing Hit (a roll on the Vehicle Damage Table).` : "No Glancing Hits."),
      );
    } else {
      lines.push(
        `- **Result:** about **${n(r.expectedDamage)} Hull Points** lost from ${n(r.unsaved)} unsaved Penetrating Hits (Damage ${dmgLabel(i, r)}), ` +
          `plus ${n(r.unsavedGlancing!)} Glancing Hits, each a roll on the Vehicle Damage Table.`,
      );
    }
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
    "_Expected values. Modelled: Rending, Critical Hit, Breaching, Shred, Armourbane, Melta, Shield-breaker (when listed in special_rules); void shields and ion shields on the target. " +
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
  return `${heresyStamp()}\n\n# Horus Heresy attack${head}\n\n**Answer, by ${attacks.some((a) => a.input.titan) ? "location" : "weapon profile"}:**\n${answers}\n\n${details}`;
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
      facing: z.enum(["front", "side", "rear"]).optional().describe("Vehicle target's facing (default front). Knights have only front and rear; ion shields give 5+ front, 6+ rear"),
      location: z.string().optional().describe("Titan or Ordinatus: the profile targeted, e.g. 'legs', 'carapace', 'head', 'arms', 'gun'. Omit to compare every location ('which part should I shoot?')"),
      crippled: z.boolean().optional().describe("Titan or Ordinatus: the named location is Crippled (Exposed Armour)"),
      crippled_locations: z.array(z.string()).optional().describe("Titan or Ordinatus: every location already Crippled (0 Hull Points), e.g. ['arms']"),
      shields_up: z.number().min(0).optional().describe("Void shields still up on the target, if some are down (default: all of them)"),
      firing_models: z.number().min(1).optional().describe("How many models attack, when the querent gives models, not shots ('five bolters')"),
      attack_type: z.enum(["ranged", "melee"]).optional().describe("Shooting Attack ('ranged') or melee ('melee'); only needed for a weapon with both"),
      attacks: z.number().min(1).optional().describe("Number of Hit Test dice, when the querent gives shots ('ten shots')"),
      ballistic_skill: z.number().min(1).max(12).optional().describe("Ranged: the firer's BS (default 4)"),
      snap_shots: z.boolean().optional().describe("Ranged: the attack is made as Snap Shots"),
      within_melta_range: z.boolean().optional().describe("Ranged, Melta (X) weapon vs a vehicle: the target is within X\" (Armourbane, and Penetrating Hits do double Damage). Omit if unknown: the answer gives both"),
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
            "Rending (X), Critical Hit (X), Breaching (X), Shred (X), Armourbane and Melta (X) are modelled; others are named as not modelled.",
        ),
    },
    async (a) => {
      const req: AttackRequest = {
        weapon: a.weapon,
        target: a.target,
        attacker: a.attacker,
        facing: a.facing,
        location: a.location,
        crippled: a.crippled,
        crippledLocations: a.crippled_locations,
        shieldsUp: a.shields_up,
        firingModels: a.firing_models,
        attackType: a.attack_type,
        attacks: a.attacks,
        ballisticSkill: a.ballistic_skill,
        snapShots: a.snap_shots,
        withinMeltaRange: a.within_melta_range,
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
