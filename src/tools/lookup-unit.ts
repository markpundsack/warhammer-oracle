import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { UNITS_11E } from "../data/units-11e.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { HERESY_UNITS, HERESY_FACTIONS } from "../data/heresy-units.js";
import { fuzzySearch, normalizeName, rankByName } from "../lib/search.js";
import { formatHeresyUnit, heresyContentKey, heresyStamp, HERESY_LABEL } from "../lib/heresy-format.js";
import {
  rankUnitMatches,
  ambiguousFactionMatches,
  datasheetContentKey,
  resolveAbilityOnlyAmbiguity,
  resolveHomeDatasheet,
} from "../lib/unit-match.js";
import type { AbilityVariantException, HomeDatasheetResolution } from "../lib/unit-match.js";
import { otherGamePointer, shouldCrossOver, stripCatalogueTag, scoreTaggedName, withCrossSystemNote } from "../lib/cross-system.js";
import { formatCompositionSection, formatModeStamp, formatUnitSize, formatWargearSection } from "../lib/format.js";
import type {
  HeresyUnit,
  Unit,
  UnitProfile,
  RangedWeapon,
  MeleeWeapon,
  Ability,
  KillTeamOperative,
  KillTeamOperativeProfile,
  KillTeamWeapon,
} from "../types.js";

// === 40K Formatters ===

function formatStatsTable(profiles: UnitProfile[]): string {
  const header = "| Name | M | T | SV | W | LD | OC |";
  const separator = "|---|---|---|---|---|---|---|";
  const rows = profiles.map(
    (p) =>
      `| ${p.name} | ${p.movement} | ${p.toughness} | ${p.save} | ${p.wounds} | ${p.leadership} | ${p.objectiveControl} |`,
  );
  return [header, separator, ...rows].join("\n");
}

function formatRangedWeapons(weapons: RangedWeapon[]): string {
  if (weapons.length === 0) return "";
  const header = "| Weapon | Range | A | BS | S | AP | D | Keywords |";
  const separator = "|---|---|---|---|---|---|---|---|";
  const rows = weapons.map(
    (w) =>
      `| ${w.name} | ${w.range} | ${w.attacks} | ${w.ballisticSkill} | ${w.strength} | ${w.armourPenetration} | ${w.damage} | ${w.keywords.join(", ") || "-"} |`,
  );
  return `### Ranged Weapons\n\n${[header, separator, ...rows].join("\n")}`;
}

function formatMeleeWeapons(weapons: MeleeWeapon[]): string {
  if (weapons.length === 0) return "";
  const header = "| Weapon | Range | A | WS | S | AP | D | Keywords |";
  const separator = "|---|---|---|---|---|---|---|---|";
  const rows = weapons.map(
    (w) =>
      `| ${w.name} | ${w.range} | ${w.attacks} | ${w.weaponSkill} | ${w.strength} | ${w.armourPenetration} | ${w.damage} | ${w.keywords.join(", ") || "-"} |`,
  );
  return `### Melee Weapons\n\n${[header, separator, ...rows].join("\n")}`;
}

function formatAbilities(abilities: Ability[]): string {
  if (abilities.length === 0) return "";
  const lines = abilities.map((a) => `- **${a.name}**: ${a.description}`);
  return `### Abilities\n\n${lines.join("\n")}`;
}

function formatUnit(unit: Unit): string {
  const sections: string[] = [];

  // Header
  const pointsStr = unit.points !== null ? ` — ${unit.points} pts` : "";
  sections.push(
    `# ${unit.name}\n\n**Faction:** ${unit.faction}${pointsStr} | **Unit Size:** ${formatUnitSize(unit.unitSize)}`,
  );

  // Composition
  const composition = formatCompositionSection(unit.composition, unit.unitSize);
  if (composition) sections.push(composition);

  // Stats
  sections.push(`### Unit Profiles\n\n${formatStatsTable(unit.profiles)}`);

  // Weapons
  const ranged = formatRangedWeapons(unit.rangedWeapons);
  if (ranged) sections.push(ranged);

  const melee = formatMeleeWeapons(unit.meleeWeapons);
  if (melee) sections.push(melee);

  // Wargear options (which of the weapons above each model has by default, and what it can swap to)
  const wargear = formatWargearSection(unit.wargear);
  if (wargear) sections.push(wargear);

  // Abilities
  const abilities = formatAbilities(unit.abilities);
  if (abilities) sections.push(abilities);

  // Keywords
  if (unit.keywords.length > 0) {
    sections.push(`### Keywords\n\n${unit.keywords.join(", ")}`);
  }

  return sections.join("\n\n");
}

// === Kill Team Formatters ===

function formatKTProfile(profile: KillTeamOperativeProfile): string {
  const header = "| Name | APL | Move | Save | Wounds |";
  const separator = "|---|---|---|---|---|";
  const row = `| ${profile.name} | ${profile.apl} | ${profile.movement} | ${profile.save} | ${profile.wounds} |`;
  return [header, separator, row].join("\n");
}

function formatKTWeapons(weapons: KillTeamWeapon[]): string {
  if (weapons.length === 0) return "";
  const ranged = weapons.filter((w) => w.type === "ranged");
  const melee = weapons.filter((w) => w.type === "melee");
  const sections: string[] = [];

  if (ranged.length > 0) {
    const header = "| Weapon | ATK | HIT | DMG | WR |";
    const separator = "|---|---|---|---|---|";
    const rows = ranged.map(
      (w) => `| ${w.name} | ${w.attacks} | ${w.hit} | ${w.damage} | ${w.weaponRules || "-"} |`,
    );
    sections.push(`### Ranged Weapons\n\n${[header, separator, ...rows].join("\n")}`);
  }

  if (melee.length > 0) {
    const header = "| Weapon | ATK | HIT | DMG | WR |";
    const separator = "|---|---|---|---|---|";
    const rows = melee.map(
      (w) => `| ${w.name} | ${w.attacks} | ${w.hit} | ${w.damage} | ${w.weaponRules || "-"} |`,
    );
    sections.push(`### Melee Weapons\n\n${[header, separator, ...rows].join("\n")}`);
  }

  return sections.join("\n\n");
}

function formatKTOperative(op: KillTeamOperative): string {
  const sections: string[] = [];

  sections.push(`# ${op.name}\n\n**Faction:** ${op.faction} | **Game:** Kill Team`);

  sections.push(`### Operative Profile\n\n${formatKTProfile(op.profile)}`);

  const weapons = formatKTWeapons(op.weapons);
  if (weapons) sections.push(weapons);

  const abilities = formatAbilities(op.abilities);
  if (abilities) sections.push(abilities);

  if (op.uniqueActions.length > 0) {
    const lines = op.uniqueActions.map((a) => `- **${a.name}**: ${a.description}`);
    sections.push(`### Unique Actions\n\n${lines.join("\n")}`);
  }

  if (op.keywords.length > 0) {
    sections.push(`### Keywords\n\n${op.keywords.join(", ")}`);
  }

  return sections.join("\n\n");
}

function formatFactionDisambiguation(
  name: string,
  options: { name: string; faction: string; id: string }[],
): string {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.faction, (counts.get(option.faction) ?? 0) + 1);
  const needsId = [...counts.values()].some((count) => count > 1);
  const list = options
    .map((o) => `- **${o.name}** (${o.faction})${(counts.get(o.faction) ?? 0) > 1 ? ` — datasheet_id: \`${o.id}\`` : ""}`)
    .join("\n");
  return (
    `"${name}" is more than one datasheet with different stats, weapons, abilities, points, or other details. ` +
    `Re-run \`lookup_unit\` with the \`faction\` argument${needsId ? " and \`datasheet_id\` when shown" : ""} set to one of:\n\n${list}`
  );
}

function formatAbilityVariantNote(exceptions: AbilityVariantException[]): string {
  const lines = exceptions.map((e) => {
    const diffs = [
      e.gained.length > 0 ? `also has ${e.gained.join(", ")}` : "",
      e.lost.length > 0 ? `does not have ${e.lost.join(", ")}` : "",
    ].filter(Boolean);
    return `- ${e.factions.join(", ")}: ${diffs.join("; ")}`;
  });
  return (
    `_Shown as most factions field it. Same datasheet, different abilities in:_\n${lines.join("\n")}\n` +
    `_Re-run \`lookup_unit\` with \`faction\` for that version._`
  );
}

// === Horus Heresy ===

const HERESY_UNIT_NAMES = new Set(HERESY_UNITS.map((u) => normalizeName(u.name)));
const UNIT_NAMES_40K = new Set([...UNITS_11E, ...UNITS].map((u) => normalizeName(stripCatalogueTag(u.name))));

/** A one-line pointer to the other game, only when a datasheet of exactly this name exists there. */
function heresyHint(name: string): string {
  return HERESY_UNIT_NAMES.has(normalizeName(stripCatalogueTag(name)))
    ? `\n\n_"${stripCatalogueTag(name)}" is also a ${HERESY_LABEL} unit; ask with game_mode "heresy" for that datasheet._`
    : "";
}

function fortyKHint(name: string): string {
  return UNIT_NAMES_40K.has(normalizeName(name))
    ? `\n\n_"${name}" is also a Warhammer 40,000 unit name; ask with game_mode "40k" for the 40K datasheet._`
    : "";
}

/** A lookup's response, how well its best match names the query (0 when nothing matched), and that match's name. */
type LookupResult = { text: string; score: number; closest?: string };

function reply(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function lookupHeresyUnit(unitName: string, faction?: string, datasheetId?: string): LookupResult {
  let candidates: HeresyUnit[] = [...HERESY_UNITS];
  // A Legion name also finds the generic Legiones Astartes units it can field.
  if (faction) candidates = fuzzySearch(candidates, faction, ["faction", "availableIn"]);
  if (datasheetId) candidates = candidates.filter((u) => u.id === datasheetId);

  // Among equal name scores, the shortest name is the closest match
  // ("Contemptor" → "Contemptor Dreadnought", not "Contemptor-Incaendius Dreadnought").
  const ranked = rankByName(candidates, unitName, (u) => u.name, 0.3).sort(
    (a, b) => b.score - a.score || a.item.name.length - b.item.name.length,
  );
  if (ranked.length === 0) {
    return {
      score: 0,
      text:
        `${heresyStamp()}\n\nNo ${HERESY_LABEL} unit found matching "${unitName}".` +
        `${faction ? ` (faction filter: "${faction}")` : ""}${datasheetId ? ` (datasheet_id: "${datasheetId}")` : ""}\n\n` +
        `Try a partial name or check the spelling. Note: Legion units are named without "Legion" (e.g. "Tactical Squad").`,
    };
  }
  const score = ranked[0].score;
  const closest = ranked[0].item.name;

  // Same-name datasheets: identical copies (e.g. each Legion's own "Inductii
  // Squad") collapse to one; genuinely different ones need a faction.
  const top = ranked[0].item;
  const sameName = ranked.map((r) => r.item).filter((u) => normalizeName(u.name) === normalizeName(top.name));
  const contents = new Map<string, HeresyUnit[]>();
  for (const u of sameName) contents.set(heresyContentKey(u), [...(contents.get(heresyContentKey(u)) ?? []), u]);
  if (contents.size > 1 && score >= 0.9) {
    const options = [...contents.values()].map((group) => group[0]);
    const lines = options.map((o) => `- **${o.name}** (${o.faction}) — datasheet_id: \`${o.id}\``);
    return {
      score,
      closest,
      text:
        `${heresyStamp()}\n\n"${top.name}" is more than one ${HERESY_LABEL} datasheet with different stats, weapons, rules or points. ` +
        `Re-run \`lookup_unit\` with game_mode "heresy" and the \`faction\` (or \`datasheet_id\`) set to one of:\n\n${lines.join("\n")}`,
    };
  }
  const alsoIn = (contents.get(heresyContentKey(top)) ?? []).filter((u) => u !== top).map((u) => u.faction);
  return { score, closest, text: formatHeresyUnit(top, HERESY_FACTIONS, alsoIn) + fortyKHint(top.name) };
}

function lookup40kUnit(
  unitName: string,
  faction: string | undefined,
  datasheetId: string | undefined,
  gameSystem: "wh40k-10e" | "wh40k-11e",
): LookupResult {
  let candidates: Unit[] = [...(gameSystem === "wh40k-10e" ? UNITS : UNITS_11E)];
  if (faction) candidates = fuzzySearch(candidates, faction, ["faction"]);
  if (datasheetId) candidates = candidates.filter((unit) => unit.id === datasheetId);

  const matches = rankUnitMatches(candidates, unitName, datasheetContentKey);
  if (matches.length === 0) {
    const suggestion = faction
      ? `Try a different faction or check the spelling.`
      : `Try a partial name or check the spelling.`;
    return {
      score: 0,
      text: `No unit found matching "${unitName}".${faction ? ` (faction filter: "${faction}")` : ""}${datasheetId ? ` (datasheet_id: "${datasheetId}")` : ""}\n\n${suggestion}`,
    };
  }
  const score = scoreTaggedName(unitName, matches[0].name);
  const closest = matches[0].name;
  const stamp = formatModeStamp(gameSystem);
  const hint = heresyHint(matches[0].name) || heresyHint(unitName);

  const ambiguous = ambiguousFactionMatches(matches, unitName, datasheetContentKey);
  // Same datasheet apart from per-army rules (#13): answer with the copy most armies share.
  const abilityOnly = ambiguous ? resolveAbilityOnlyAmbiguity(ambiguous, datasheetContentKey) : null;
  if (abilityOnly) {
    return {
      score,
      closest,
      text: `${stamp}\n\n${formatUnit(abilityOnly.pick)}\n\n${formatAbilityVariantNote(abilityOnly.exceptions)}${hint}`,
    };
  }
  // Fallback: with no faction given, a datasheet shared by most armies answers directly
  // from its home army; a faction filter means same-faction variants are a real choice.
  const home = ambiguous && !faction && !datasheetId ? resolveHomeDatasheet(ambiguous, datasheetContentKey) : null;
  if (home) {
    return { score, closest, text: `${stamp}\n\n${formatUnit(home.pick)}\n\n${formatHomeDatasheetNote(home)}${hint}` };
  }
  if (ambiguous) {
    return { score, closest, text: `${formatFactionDisambiguation(matches[0].name, ambiguous)}${hint}` };
  }
  return { score, closest, text: `${stamp}\n\n${formatUnit(matches[0])}${hint}` };
}

/** "Adeptus Astartes - Ultramarines" → "Ultramarines"; short enough to read aloud. */
function shortFaction(faction: string): string {
  return faction.replace(/^Adeptus Astartes - /, "");
}

function listFactions(factions: string[]): string {
  const names = factions.map(shortFaction);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others`;
}

const STAT_FIELDS: [keyof UnitProfile, string][] = [
  ["movement", "M"],
  ["toughness", "T"],
  ["save", "Sv"],
  ["wounds", "W"],
  ["leadership", "Ld"],
  ["objectiveControl", "OC"],
];

/** Weapon names whose profile differs, or that only one copy has (case-insensitive name match). */
function differingWeapons<W extends { name: string }>(a: W[], b: W[]): string[] {
  const key = (w: W) => JSON.stringify({ ...w, name: w.name.toLowerCase() });
  const aKeys = new Set(a.map(key));
  const bKeys = new Set(b.map(key));
  const names = new Map<string, string>();
  for (const w of [...a.filter((x) => !bKeys.has(key(x))), ...b.filter((x) => !aKeys.has(key(x)))]) {
    names.set(w.name.toLowerCase(), names.get(w.name.toLowerCase()) ?? w.name);
  }
  return [...names.values()];
}

/** A short, speakable summary of what `other` changes relative to the shown datasheet. */
function describeDifferences(shown: Unit, other: Unit): string {
  const parts: string[] = [];
  if (other.points !== shown.points) parts.push(other.points === null ? "no points listed" : `${other.points} pts`);
  if (JSON.stringify(other.unitSize) !== JSON.stringify(shown.unitSize)) parts.push(formatUnitSize(other.unitSize));

  if (other.profiles.length === shown.profiles.length) {
    const stats = new Set<string>();
    other.profiles.forEach((p, i) => {
      for (const [field, label] of STAT_FIELDS) {
        if (p[field] !== shown.profiles[i][field]) stats.add(`${label} ${p[field]}`);
      }
    });
    parts.push(...stats);
  } else {
    parts.push("different stat lines");
  }

  const weapons = differingWeapons(
    [...shown.rangedWeapons, ...shown.meleeWeapons],
    [...other.rangedWeapons, ...other.meleeWeapons],
  );
  if (weapons.length > 0) {
    const named = weapons.slice(0, 3).join(", ");
    parts.push(`different ${named}${weapons.length > 3 ? ` and ${weapons.length - 3} more weapons` : ""}`);
  }

  if (JSON.stringify(other.abilities) !== JSON.stringify(shown.abilities)) {
    const shownNames = new Set(shown.abilities.map((a) => a.name));
    const otherNames = new Set(other.abilities.map((a) => a.name));
    const lost = [...shownNames].filter((n) => !otherNames.has(n));
    const gained = [...otherNames].filter((n) => !shownNames.has(n));
    if (lost.length + gained.length === 0 || lost.length + gained.length > 3) parts.push("different abilities");
    else {
      if (lost.length > 0) parts.push(`without ${lost.join(", ")}`);
      if (gained.length > 0) parts.push(`with ${gained.join(", ")}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "different keywords";
}

function formatHomeDatasheetNote(resolution: HomeDatasheetResolution<Unit>): string {
  const lines = [`Shown from ${shortFaction(resolution.pick.faction)}, its home army.`];
  if (resolution.alsoFieldedBy.length > 0) {
    lines.push(`${listFactions(resolution.alsoFieldedBy)} field the same datasheet.`);
  }
  const others = resolution.variants.map(
    (v) => `${listFactions(v.factions)} (${describeDifferences(resolution.pick, v.entry)})`,
  );
  lines.push(`Other versions: ${others.join("; ")}.`);
  lines.push("Re-run `lookup_unit` with `faction` for another army's version.");
  return `**Note:** ${lines.join(" ")}`;
}

// === Tool Registration ===

export function registerLookupUnit(server: McpServer): void {
  server.tool(
    "lookup_unit",
    "Look up a Warhammer 40K unit, Kill Team operative, or Horus Heresy (3rd edition, '30K') unit datasheet by name. " +
      "Returns stats, weapons, abilities/special rules, and keywords; for 40K units also the unit composition (how many " +
      "of each model) and wargear options (default loadout and what each model can take). Use game_mode 'heresy' for Horus Heresy.",
    {
      unit_name: z.string().describe("Name or partial name of the unit to search for"),
      faction: z
        .string()
        .optional()
        .describe(
          "Optional faction name to narrow results (e.g. 'Chaos Space Marines', 'Astartes'; for Horus Heresy a Legion " +
            "such as 'Ultramarines', 'Solar Auxilia', 'Mechanicum')",
        ),
      datasheet_id: z
        .string()
        .optional()
        .describe("Optional exact datasheet ID shown for variants that share a name and faction; pass with faction"),
      game_mode: z
        .enum(["40k", "40k_10e", "40k_11e", "combat_patrol", "kill_team", "heresy"])
        .optional()
        .describe(
          "Game mode/edition: defaults to '40k_11e'. Pass '40k_10e' for 10th Edition units, " +
            "'40k'/'40k_11e' for 11th Edition (current default), 'kill_team' for Kill Team operatives, " +
            "or 'heresy' for Horus Heresy 3rd edition (30K) units.",
        ),
    },
    async ({ unit_name, faction, datasheet_id, game_mode }) => {
      if (game_mode === "heresy") {
        const heresy = lookupHeresyUnit(unit_name, faction, datasheet_id);
        // Explicit game_mode: never substitute 40K, but point at a clear 40K match.
        if (!datasheet_id) {
          const fortyK = lookup40kUnit(unit_name, faction, undefined, "wh40k-11e");
          if (shouldCrossOver(heresy.score, fortyK.score)) {
            return reply(withCrossSystemNote(heresy.text, heresyStamp(), otherGamePointer("40k", fortyK.closest!)));
          }
        }
        return reply(heresy.text);
      }

      if (game_mode === "kill_team") {
        let candidates: KillTeamOperative[] = [...KILL_TEAM_OPERATIVES];

        if (faction) {
          candidates = fuzzySearch(candidates, faction, ["faction"]);
        }
        if (datasheet_id) candidates = candidates.filter((op) => op.id === datasheet_id);

        const matches = rankUnitMatches(candidates, unit_name, datasheetContentKey);

        if (matches.length === 0) {
          const suggestion = faction
            ? `Try a different faction or check the spelling.`
            : `Try a partial name or check the spelling.`;
          return {
            content: [
              {
                type: "text" as const,
                text: `No Kill Team operative found matching "${unit_name}".${faction ? ` (faction filter: "${faction}")` : ""}${datasheet_id ? ` (datasheet_id: "${datasheet_id}")` : ""}\n\n${suggestion}`,
              },
            ],
          };
        }

        const ktAmbiguous = ambiguousFactionMatches(matches, unit_name, datasheetContentKey);
        if (ktAmbiguous) {
          return {
            content: [
              { type: "text" as const, text: formatFactionDisambiguation(matches[0].name, ktAmbiguous) },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `${formatModeStamp("wh40k-killteam")}\n\n${formatKTOperative(matches[0])}`,
            },
          ],
        };
      }

      // Default: 40K units (11th Edition unless 10th Edition is explicitly requested)
      const gameSystem = game_mode === "40k_10e" ? "wh40k-10e" : "wh40k-11e";
      const fortyK = lookup40kUnit(unit_name, faction, datasheet_id, gameSystem);
      if (!datasheet_id) {
        const heresy = lookupHeresyUnit(unit_name, faction);
        if (shouldCrossOver(fortyK.score, heresy.score)) {
          // No game_mode: a name with no good 40K match but a clear Heresy one answers from Heresy.
          if (game_mode === undefined) {
            const closest = fortyK.score >= 0.55 ? ` Closest 40K unit: ${fortyK.closest}.` : "";
            return reply(withCrossSystemNote(heresy.text, heresyStamp(), `Found in Horus Heresy, not 40K.${closest}`));
          }
          // Explicit 40K mode: keep the 40K answer, add a pointer.
          return reply(withCrossSystemNote(fortyK.text, formatModeStamp(gameSystem), otherGamePointer("heresy", heresy.closest!)));
        }
      }
      return reply(fortyK.text);
    },
  );
}
