/**
 * Formatting and matching for Horus Heresy 3rd Edition (game_mode "heresy").
 *
 * Every Heresy response starts with the "[Mode: Horus Heresy (3rd edition)]"
 * stamp, like 40K's "[Mode: 40k 11e]", uses HH3's own stat names
 * (WS/BS/S/T/W/I/A/LD/CL/WP/IN/SAV/INV; R/FP/RS/AP/D; IM/AM/SM), and never
 * mixes in 40K content. Melee weapons are spelled out as modifiers to the
 * bearer ("Strength: user +4"), because a voice assistant reading "S +4" or
 * "SM 4" aloud would otherwise state a weapon strength that doesn't exist.
 */
import type {
  HeresyFaction,
  HeresyMeleeWeapon,
  HeresyRangedWeapon,
  HeresyRuleKind,
  HeresySpecialRule,
  HeresyUnit,
  HeresyWeapon,
} from "../types.js";
import { formatModeStamp, formatUnitSize } from "./format.js";
import { normalizeName, rankByName, scoreName } from "./search.js";

export const HERESY_LABEL = "Horus Heresy (3rd edition)";

export function heresyStamp(): string {
  return formatModeStamp("horus-heresy-3e");
}

// === Melee modifiers ===

/**
 * How a melee weapon's IM/AM/SM value applies to the bearer, for reading
 * aloud: "S" → "as user", "+4" → "user +4", "-3" → "user -3", "x2" →
 * "user x2". A bare number is shown "as listed": the data doesn't mark it as
 * a modifier, and doesn't say whether it replaces the bearer's value.
 */
export function formatMeleeModifier(value: string, stat: "I" | "A" | "S"): string {
  const v = value.trim();
  if (!v || v === "-") return "-";
  if (v.toUpperCase() === stat) return "as user";
  if (/^[+-]\s*\d+$/.test(v)) return `user ${v.replace(/\s+/g, "")}`;
  if (/^[x×]\s*\d+$/i.test(v)) return `user x${v.replace(/^[x×]\s*/i, "")}`;
  if (/^\d+$/.test(v)) return `${v} (as listed)`;
  return v;
}

function list(items: string[]): string {
  return items.length ? items.join(", ") : "-";
}

// === Profiles ===

function formatModelTable(unit: HeresyUnit): string {
  if (unit.models.length === 0) return "";
  const header = "| Model | Type | M | WS | BS | S | T | W | I | A | LD | CL | WP | IN | SAV | INV |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";
  const rows = unit.models.map(
    (m) =>
      `| ${m.name} | ${m.type} | ${m.movement} | ${m.weaponSkill} | ${m.ballisticSkill} | ${m.strength} | ${m.toughness} | ${m.wounds} | ${m.initiative} | ${m.attacks} | ${m.leadership} | ${m.cool} | ${m.willpower} | ${m.intelligence} | ${m.save} | ${m.invulnerableSave} |`,
  );
  return [
    "### Model Profiles",
    "",
    [header, sep, ...rows].join("\n"),
    "",
    "_LD = Leadership, CL = Cool, WP = Willpower, IN = Intelligence, SAV = Armour Save, INV = Invulnerable Save._",
  ].join("\n");
}

function formatArmouredProfiles(unit: HeresyUnit): string {
  if (unit.armoured.length === 0) return "";
  // Group by profile kind so each table has one set of columns.
  const byKind = new Map<string, typeof unit.armoured>();
  for (const p of unit.armoured) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);
  const blocks: string[] = [];
  for (const [kind, profiles] of byKind) {
    const columns = profiles[0].stats.map((s) => s.name);
    const longColumns = columns.filter((c) => profiles.some((p) => (p.stats.find((s) => s.name === c)?.value.length ?? 0) > 30));
    const tableColumns = columns.filter((c) => !longColumns.includes(c));
    const header = `| ${kind} | ${tableColumns.join(" | ")} |`;
    const sep = `|${"---|".repeat(tableColumns.length + 1)}`;
    const rows = profiles.map(
      (p) => `| ${p.name} | ${tableColumns.map((c) => p.stats.find((s) => s.name === c)?.value ?? "").join(" | ")} |`,
    );
    const notes = profiles.flatMap((p) =>
      longColumns.map((c) => `- ${p.name} — ${c}: ${p.stats.find((s) => s.name === c)?.value ?? ""}`),
    );
    blocks.push([[header, sep, ...rows].join("\n"), ...(notes.length ? ["", ...notes] : [])].join("\n"));
  }
  return `### Armoured Profiles\n\n${blocks.join("\n\n")}\n\n_HP = Hull Points._`;
}

// === Weapons ===

export function formatHeresyRangedTable(weapons: HeresyRangedWeapon[]): string {
  if (weapons.length === 0) return "";
  const header = "| Weapon | Range (R) | Firepower (FP) | Ranged Strength (RS) | AP | Damage (D) | Special Rules | Traits |";
  const sep = "|---|---|---|---|---|---|---|---|";
  const rows = weapons.map(
    (w) =>
      `| ${w.name} | ${w.range} | ${w.firepower} | ${w.rangedStrength} | ${w.ap} | ${w.damage} | ${list(w.specialRules)} | ${list(w.traits)} |`,
  );
  return `### Ranged Weapons\n\n${[header, sep, ...rows].join("\n")}`;
}

export function formatHeresyMeleeTable(weapons: HeresyMeleeWeapon[]): string {
  if (weapons.length === 0) return "";
  const header =
    "| Weapon | Initiative (IM) | Attacks (AM) | Strength (SM) | AP | Damage (D) | Special Rules | Traits |";
  const sep = "|---|---|---|---|---|---|---|---|";
  const rows = weapons.map(
    (w) =>
      `| ${w.name} | ${formatMeleeModifier(w.initiativeModifier, "I")} | ${formatMeleeModifier(w.attacksModifier, "A")} | ${formatMeleeModifier(w.strengthModifier, "S")} | ${w.ap} | ${w.damage} | ${list(w.specialRules)} | ${list(w.traits)} |`,
  );
  return (
    `### Melee Weapons\n\n` +
    `_Melee weapons modify the bearer's own characteristics: "user +4" means the bearer's value plus 4; "as user" means the bearer's value unchanged._\n\n` +
    [header, sep, ...rows].join("\n")
  );
}

/** One melee profile as a sentence, e.g. "Power fist: Initiative user -3, Attacks as user, Strength user +4, AP 2, Damage 2." */
export function describeHeresyMelee(w: HeresyMeleeWeapon): string {
  const rules = w.specialRules.length ? `; special rules: ${w.specialRules.join(", ")}` : "";
  const traits = w.traits.length ? `; traits: ${w.traits.join(", ")}` : "";
  return (
    `${w.name}: Initiative ${formatMeleeModifier(w.initiativeModifier, "I")}, Attacks ${formatMeleeModifier(w.attacksModifier, "A")}, ` +
    `Strength ${formatMeleeModifier(w.strengthModifier, "S")}, AP ${w.ap}, Damage ${w.damage}${rules}${traits}.`
  );
}

/** One ranged profile as a sentence, e.g. "Volkite culverin: Range 45, Firepower 3, Ranged Strength 6, AP 5, Damage 1; ...". */
export function describeHeresyRanged(w: HeresyRangedWeapon): string {
  const rules = w.specialRules.length ? `; special rules: ${w.specialRules.join(", ")}` : "";
  const traits = w.traits.length ? `; traits: ${w.traits.join(", ")}` : "";
  return `${w.name}: Range ${w.range}, Firepower ${w.firepower}, Ranged Strength ${w.rangedStrength}, AP ${w.ap}, Damage ${w.damage}${rules}${traits}.`;
}

/**
 * A weapon entry with all its profiles (e.g. plasma gun Maximal and
 * Sustained) — the Heresy output for a weapon lookup. Kept tool-agnostic so a
 * `lookup_weapon` tool (PR #12) can call it from a `game_mode: "heresy"`
 * branch.
 */
export function formatHeresyWeapon(weapons: HeresyWeapon[]): string {
  const name = weapons[0]?.name ?? "";
  const sections: string[] = [heresyStamp(), `# ${name}`];
  for (const w of weapons) {
    const lines: string[] = [];
    if (weapons.length > 1) lines.push(`**Listed in:** ${w.source}`);
    if (w.ranged.length > 1) lines.push(`${w.ranged.length} ranged profiles:`);
    for (const r of w.ranged) lines.push(`- ${describeHeresyRanged(r)}`);
    for (const m of w.melee) lines.push(`- ${describeHeresyMelee(m)}`);
    sections.push(lines.join("\n"));
    const ranged = formatHeresyRangedTable(w.ranged);
    if (ranged) sections.push(ranged);
    const melee = formatHeresyMeleeTable(w.melee);
    if (melee) sections.push(melee);
  }
  return sections.join("\n\n");
}

// === Units ===

function formatPoints(unit: HeresyUnit): string {
  if (!unit.points) return "";
  const extras = unit.points.perExtraModel.map((p) => `+${p.points} per extra ${p.model}`);
  return ` — ${unit.points.base} pts${extras.length ? ` (${extras.join(", ")})` : ""}`;
}

/**
 * "Available to" line. Generic Legiones Astartes units are fielded by every
 * Legion, so a list naming them all is collapsed to "every Legion".
 */
export function formatAvailability(unit: HeresyUnit, factions: HeresyFaction[]): string {
  if (unit.availableIn.length === 0) return "";
  const legions = factions.filter((f) => f.legion !== null).map((f) => f.name);
  const set = new Set(unit.availableIn);
  if (legions.length > 0 && legions.every((l) => set.has(l))) {
    const others = unit.availableIn.filter((n) => !legions.includes(n));
    return `every Legion (all ${legions.length} Legion catalogues)${others.length ? `, ${others.join(", ")}` : ""}`;
  }
  return unit.availableIn.join(", ");
}

function factionLabel(unit: HeresyUnit, factions: HeresyFaction[]): string {
  const f = factions.find((x) => x.name === unit.faction);
  if (f?.legion) return `${unit.faction} (${f.legion} Legion)`;
  if (unit.faction === "Legiones Astartes") return "Legiones Astartes (generic Legion unit)";
  return unit.faction;
}

function formatComposition(unit: HeresyUnit): string {
  if (unit.composition.length === 0) return "";
  if (unit.composition.length === 1 && unit.composition[0].max === 1) return "";
  const lines = unit.composition.map((c) => `- ${c.min === c.max ? c.min : `${c.min}-${c.max}`} ${c.model}`);
  return `### Unit Composition\n\n${lines.join("\n")}\n\nTotal: ${formatUnitSize(unit.unitSize)}`;
}

function formatWargear(unit: HeresyUnit): string {
  if (unit.wargear.length === 0) return "";
  const blocks = unit.wargear.map((w) => {
    const header = `**${w.model}** — default: ${w.default.join(", ") || "none listed"}`;
    return w.options.length ? [header, ...w.options.map((o) => `- ${o}`)].join("\n") : header;
  });
  return `### Wargear\n\n${blocks.join("\n\n")}`;
}

export function formatHeresyUnit(unit: HeresyUnit, factions: HeresyFaction[], alsoIn: string[] = []): string {
  const sections: string[] = [heresyStamp()];
  const availability = formatAvailability(unit, factions);
  const header = [
    `# ${unit.name}`,
    "",
    `**Faction:** ${factionLabel(unit, factions)}${formatPoints(unit)} | **Unit Size:** ${formatUnitSize(unit.unitSize)}`,
  ];
  if (alsoIn.length) header.push(`**Same datasheet also defined in:** ${alsoIn.join(", ")}`);
  if (availability) header.push(`**Available to:** ${availability}`);
  sections.push(header.join("\n"));

  const models = formatModelTable(unit);
  if (models) sections.push(models);
  const armoured = formatArmouredProfiles(unit);
  if (armoured) sections.push(armoured);
  const composition = formatComposition(unit);
  if (composition) sections.push(composition);

  const rules: string[] = [unit.specialRules.length ? unit.specialRules.join(", ") : "None listed"];
  if (unit.conditionalRules.length) {
    rules.push(`_Only with certain army options (e.g. a Rite of War or Legion choice):_ ${unit.conditionalRules.join(", ")}`);
  }
  sections.push(`### Special Rules\n\n${rules.join("\n\n")}`);

  const ranged = formatHeresyRangedTable(unit.rangedWeapons);
  if (ranged) sections.push(ranged);
  const melee = formatHeresyMeleeTable(unit.meleeWeapons);
  if (melee) sections.push(melee);

  const wargear = formatWargear(unit);
  if (wargear) sections.push(wargear);
  if (unit.wargearRules.length) {
    sections.push(`### Wargear Rules\n\n${unit.wargearRules.map((w) => `- **${w.name}**: ${w.description}`).join("\n")}`);
  }
  if (unit.traits.length) sections.push(`### Traits\n\n${unit.traits.join(", ")}`);
  if (unit.reactions.length) sections.push(`### Reactions\n\n${unit.reactions.join(", ")}`);
  return sections.join("\n\n");
}

export function formatHeresyCompactUnit(unit: HeresyUnit): string {
  const pts = unit.points ? `${unit.points.base}pts` : "pts N/A";
  const types = [...new Set([...unit.models.map((m) => m.type), ...unit.armoured.map((a) => a.stats.find((s) => s.name === "Type")?.value ?? a.kind)])];
  const rules = unit.specialRules.length ? unit.specialRules.join(", ") : "None";
  return `**${unit.name}** (${unit.faction}) — ${pts} — ${formatUnitSize(unit.unitSize)} — Type: ${types.join(", ") || "-"} — Special Rules: ${rules}`;
}

/** Content identity for collapsing identical same-name datasheets defined in several catalogues. */
export function heresyContentKey(unit: HeresyUnit): string {
  const { id: _id, faction: _f, availableIn: _a, ...rest } = unit;
  return JSON.stringify(rest);
}

// === Special rules ===

/** "Bulky (6)" → { base: "bulky", value: "6" }; "Rending" → { base: "rending", value: null }. */
export function splitRuleQuery(query: string): { base: string; value: string | null } {
  const m = query.trim().match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) {
    const value = m[2].trim();
    return { base: normalizeName(m[1]), value: value && value.toUpperCase() !== "X" ? value : null };
  }
  return { base: normalizeName(query), value: null };
}

function ruleBaseNames(rule: HeresySpecialRule): string[] {
  return [rule.name.replace(/\s*\([^)]*\)\s*$/, ""), ...rule.aliases].map(normalizeName).filter(Boolean);
}

/** How well `query` names `rule` (0..1, as `scoreName`): full name, or base name/alias with any "(X)" value ignored. */
export function scoreHeresyRule(rule: HeresySpecialRule, query: string): number {
  const { base } = splitRuleQuery(query);
  if (!base) return 0;
  return Math.max(scoreName(query, rule.name), ...ruleBaseNames(rule).map((b) => scoreName(base, b)));
}

/** Rules ranked by how well `query` names them (base name or alias; any "(X)" value ignored). */
export function findHeresyRules(rules: HeresySpecialRule[], query: string, minScore = 0.3): HeresySpecialRule[] {
  return rules
    .map((rule) => ({ rule, score: scoreHeresyRule(rule, query) }))
    .filter((r) => r.score > 0 && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.rule);
}

const KIND_LABEL: Record<HeresyRuleKind, string> = {
  "special rule": "Special Rule",
  reaction: "Reaction",
  "psychic reaction": "Psychic Reaction",
  gambit: "Gambit",
  "psychic power": "Psychic Power",
  wargear: "Wargear",
  asset: "Battlefield Asset",
  detachment: "Detachment",
  status: "Status",
  "core rule": "Core Rule",
  mission: "Mission Rule",
  "rite of war": "Rite of War",
  "army rule": "Army Rule",
  "cybertheurgic rite": "Cybertheurgic Rite",
};

export function heresyRuleKindLabel(rule: HeresySpecialRule): string {
  return KIND_LABEL[rule.kind ?? "special rule"];
}

export function formatHeresyRule(rule: HeresySpecialRule, query: string, related: HeresySpecialRule[] = []): string {
  const { value } = splitRuleQuery(query);
  const sections: string[] = [heresyStamp(), `# ${rule.name}`];
  if (rule.kind && rule.kind !== "special rule") {
    // Core-rules sections carry a "Page > Section" breadcrumb; BSData profiles name what grants them.
    const where = rule.context ? (rule.url ? ` — ${rule.context}` : ` — from ${rule.context}`) : "";
    sections.push(`**Type:** ${KIND_LABEL[rule.kind]}${where}`);
  }
  if (value && /\(X\)/i.test(rule.name)) {
    sections.push(`**As asked: ${rule.name.replace(/\(X\)/i, `(${value})`)}** — X = ${value} in the text below.`);
  }
  if (rule.summary) sections.push(`**Summary:** ${rule.summary}`);
  // The text usually opens with the summary in bold; don't read it out twice.
  const lead = `**${rule.summary}**`;
  const body = rule.summary && rule.description.startsWith(lead) ? rule.description.slice(lead.length).trim() : rule.description;
  sections.push(`## Rule Text\n\n${body || rule.description}`);
  const meta: string[] = [`**Source:** ${rule.source}`];
  if (rule.url) meta.push(`**Full rule:** ${rule.url}`);
  if (rule.aliases.length) meta.push(`**Also called:** ${rule.aliases.join(", ")}`);
  sections.push(meta.join(" | "));
  if (related.length) {
    sections.push(`_Other Horus Heresy rules with a similar name:_ ${related.map((r) => r.name).join(", ")}`);
  }
  return sections.join("\n\n");
}

// === Weapons ===

/** Weapon entries whose name best matches `query` (all entries sharing that best name). */
export function findHeresyWeapons(weapons: HeresyWeapon[], query: string): HeresyWeapon[] {
  const ranked = rankByName(weapons, query, (w) => w.name, 0.3);
  if (ranked.length === 0) return [];
  const top = normalizeName(ranked[0].item.name);
  return ranked.filter((r) => normalizeName(r.item.name) === top).map((r) => r.item);
}

// === Unit comparison ===

/**
 * 2–4 Heresy datasheets side by side: one stat table with every model of
 * every unit (so "T4 vs T5" reads off one table), points and size, then each
 * unit's special rules and weapons as one-liners.
 */
export function formatHeresyComparison(units: HeresyUnit[], factions: HeresyFaction[], notes: string[] = []): string {
  const sections: string[] = [heresyStamp(), `# Horus Heresy Unit Comparison (${units.length} unit${units.length === 1 ? "" : "s"})`];
  if (notes.length) sections.push(notes.map((n) => `> ${n}`).join("\n"));

  sections.push(
    [
      "| Unit | Faction | Points | Size |",
      "|---|---|---|---|",
      ...units.map((u) => `| ${u.name} | ${factionLabel(u, factions)} | ${formatPoints(u).replace(/^ — /, "") || "-"} | ${formatUnitSize(u.unitSize)} |`),
    ].join("\n"),
  );

  const modelRows = units.flatMap((u) =>
    u.models.map(
      (m) =>
        `| ${u.name} | ${m.name} | ${m.type} | ${m.movement} | ${m.weaponSkill} | ${m.ballisticSkill} | ${m.strength} | ${m.toughness} | ${m.wounds} | ${m.initiative} | ${m.attacks} | ${m.leadership} | ${m.cool} | ${m.willpower} | ${m.intelligence} | ${m.save} | ${m.invulnerableSave} |`,
    ),
  );
  if (modelRows.length) {
    sections.push(
      [
        "### Model Profiles",
        "",
        "| Unit | Model | Type | M | WS | BS | S | T | W | I | A | LD | CL | WP | IN | SAV | INV |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
        ...modelRows,
      ].join("\n"),
    );
  }
  for (const u of units.filter((x) => x.armoured.length)) {
    sections.push(formatArmouredProfiles(u).replace("### Armoured Profiles", `### Armoured Profiles — ${u.name}`));
  }

  for (const u of units) {
    const lines = [`### ${u.name}`, "", `**Special Rules:** ${u.specialRules.length ? u.specialRules.join(", ") : "None listed"}`];
    if (u.conditionalRules.length) lines.push(`**Only with certain army options:** ${u.conditionalRules.join(", ")}`);
    if (u.rangedWeapons.length) lines.push("", "**Ranged:**", ...u.rangedWeapons.map((w) => `- ${describeHeresyRanged(w)}`));
    if (u.meleeWeapons.length) lines.push("", "**Melee:**", ...u.meleeWeapons.map((w) => `- ${describeHeresyMelee(w)}`));
    sections.push(lines.join("\n"));
  }
  sections.push(
    "_Weapons are every profile the unit can take (default loadout and options); use lookup_unit with game_mode \"heresy\" for which model carries what. " +
      "Melee weapons modify the bearer's characteristics._",
  );
  return sections.join("\n\n");
}
