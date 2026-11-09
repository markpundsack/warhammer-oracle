import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { attachRulings } from "../lib/faq-attach.js";
import "../lib/faq-11e.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { UNITS_11E } from "../data/current-11e.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { HERESY_UNITS, HERESY_FACTIONS } from "../data/heresy-units.js";
import { fuzzySearch, normalizeName, rankByName } from "../lib/search.js";
import { formatHeresyUnit, heresyStamp, HERESY_LABEL } from "../lib/heresy-format.js";
import { findHeresyUnit, modelMatchNote } from "../lib/heresy-unit-match.js";
import {
  rankUnitMatches,
  matchUnitsWithFactionHint,
  ambiguousFactionMatches,
  datasheetContentKey,
  resolveAbilityOnlyAmbiguity,
  resolveHomeDatasheet,
} from "../lib/unit-match.js";
import type { AbilityVariantException, HomeDatasheetResolution } from "../lib/unit-match.js";
import { otherGamePointer, shouldCrossOver, stripCatalogueTag, scoreTaggedName, withCrossSystemNote, STRONG_MATCH } from "../lib/cross-system.js";
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

/** Every best-scoring 11th-edition match for this name is a [Legends] datasheet. */
function onlyLegendsMatches(unitName: string): boolean {
  const ranked = rankByName(UNITS_11E, unitName, (u) => stripCatalogueTag(u.name), 0.3);
  if (!ranked.length) return false;
  const best = ranked[0].score;
  return ranked.filter((r) => r.score === best).every((r) => /\[legends\]/i.test(r.item.name));
}

function lookupHeresyUnit(unitName: string, faction?: string, datasheetId?: string): LookupResult {
  const match = findHeresyUnit(unitName, { faction, datasheetId });
  if (!match) {
    return {
      score: 0,
      text:
        `${heresyStamp()}\n\nNo ${HERESY_LABEL} unit found matching "${unitName}".` +
        `${faction ? ` (faction filter: "${faction}")` : ""}${datasheetId ? ` (datasheet_id: "${datasheetId}")` : ""}\n\n` +
        `Try a partial name or check the spelling. Note: Legion units are named without "Legion" (e.g. "Tactical Squad").`,
    };
  }
  if (match.kind === "model") {
    // Scored a little under a unit-name match, so a model name alone never pulls a no-game_mode question over from 40K.
    const text = withCrossSystemNote(formatHeresyUnit(match.unit, HERESY_FACTIONS, []), heresyStamp(), modelMatchNote(match, unitName).replace(/^_|_$/g, ""));
    return { score: match.score * 0.95, closest: match.unit.name, text };
  }
  const { unit: top, score, variants, alsoIn } = match;
  if (variants.length > 1) {
    const lines = variants.map((o) => `- **${o.name}** (${o.faction}) — datasheet_id: \`${o.id}\``);
    return {
      score,
      closest: top.name,
      text:
        `${heresyStamp()}\n\n"${top.name}" is more than one ${HERESY_LABEL} datasheet with different stats, weapons, rules or points. ` +
        `Re-run \`lookup_unit\` with game_mode "heresy" and the \`faction\` (or \`datasheet_id\`) set to one of:\n\n${lines.join("\n")}`,
    };
  }
  return { score, closest: top.name, text: formatHeresyUnit(top, HERESY_FACTIONS, alsoIn) + fortyKHint(top.name) };
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

  // "Grey Knight Paladins" → Paladin Squad: a leading army name narrows the search.
  const { matches, query } = matchUnitsWithFactionHint(candidates, unitName, datasheetContentKey);
  if (matches.length === 0) {
    const suggestion = faction
      ? `Try a different faction or check the spelling.`
      : `Try a partial name or check the spelling.`;
    return {
      score: 0,
      text: `No unit found matching "${unitName}".${faction ? ` (faction filter: "${faction}")` : ""}${datasheetId ? ` (datasheet_id: "${datasheetId}")` : ""}\n\n${suggestion}`,
    };
  }
  const score = scoreTaggedName(query, matches[0].name);
  const closest = matches[0].name;
  const stamp = formatModeStamp(gameSystem);
  const hint = heresyHint(matches[0].name) || heresyHint(unitName);

  const ambiguous = ambiguousFactionMatches(matches, query, datasheetContentKey);
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

/** Material differences of `other` from the shown datasheet: points, size, stats, then weapons. Terse, for reading aloud. */
function materialDifferences(shown: Unit, other: Unit): string[] {
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
  if (parts.length > 0) return parts;
  const weapons = differingWeapons(
    [...shown.rangedWeapons, ...shown.meleeWeapons],
    [...other.rangedWeapons, ...other.meleeWeapons],
  );
  return weapons.length > 0 ? ["different weapons"] : [];
}

function abilityChanges(shown: Unit, other: Unit): { lost: string[]; gained: string[] } {
  const shownNames = new Set(shown.abilities.map((a) => a.name));
  const otherNames = new Set(other.abilities.map((a) => a.name));
  return {
    lost: [...shownNames].filter((n) => !otherNames.has(n)),
    gained: [...otherNames].filter((n) => !shownNames.has(n)),
  };
}

/** A short summary of what `other` changes relative to the shown datasheet. */
function describeDifferences(shown: Unit, other: Unit): string {
  const material = materialDifferences(shown, other);
  if (material.length > 0) return material.join(", ");
  const { lost, gained } = abilityChanges(shown, other);
  if (lost.length + gained.length === 0) return "different keywords";
  if (lost.length + gained.length > 2) return "different abilities";
  return [...(gained.length ? [`with ${gained.join(", ")}`] : []), ...(lost.length ? [`without ${lost.join(", ")}`] : [])].join(", ");
}

/**
 * e.g. "Home: Chaos Daemons. Also fielded by 7 other armies. Variant: World Eaters (90 pts, OC 1)."
 * Copies that only lack the home army's own rules count as fielding the same datasheet.
 */
function formatHomeDatasheetNote(resolution: HomeDatasheetResolution<Unit>): string {
  const pick = resolution.pick;
  const sameSheet = (v: { entry: Unit }) => {
    if (materialDifferences(pick, v.entry).length > 0) return false;
    const { gained } = abilityChanges(pick, v.entry);
    return gained.length === 0 && JSON.stringify(v.entry.keywords) === JSON.stringify(pick.keywords);
  };
  const also = [...resolution.alsoFieldedBy, ...resolution.variants.filter(sameSheet).flatMap((v) => v.factions)];
  const variants = resolution.variants.filter((v) => !sameSheet(v));
  const lines = [`Home: ${shortFaction(pick.faction)}.`];
  if (also.length > 0) lines.push(`Also fielded by ${also.length} other ${also.length === 1 ? "army" : "armies"}.`);
  if (variants.length > 0) {
    const others = variants.map((v) => `${listFactions(v.factions)} (${describeDifferences(pick, v.entry)})`);
    lines.push(`${variants.length === 1 ? "Variant" : "Variants"}: ${others.join("; ")}.`);
  }
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

        // A kill team's own name ("Gellerpox Infected") is a faction here, not an operative: list the team.
        if (!faction && !datasheet_id) {
          const teams = rankByName([...new Set(KILL_TEAM_OPERATIVES.map((op) => op.faction))], unit_name, (t) => t, STRONG_MATCH);
          if (teams.length) {
            const team = teams[0].item;
            const ops = KILL_TEAM_OPERATIVES.filter((op) => op.faction === team);
            const lines = ops.map((op) => `- **${op.name}**: APL ${op.profile.apl}, Move ${op.profile.movement}, Save ${op.profile.save}, Wounds ${op.profile.wounds}`);
            return reply(`${formatModeStamp("wh40k-killteam")}\n\n# ${team}\n\nA Kill Team kill team with ${ops.length} operative types:\n\n${lines.join("\n")}`);
          }
        }

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
        // "Sicaran": Heresy's exact name beats a prefix of 40K datasheets that are all Legends (not 11th-edition
        // legal). A prefix of a current 40K unit ("Predator", "Leman Russ") stays 40K.
        if (game_mode === undefined && !faction && heresy.score === 1 && fortyK.score >= STRONG_MATCH && fortyK.score < 1 && onlyLegendsMatches(unit_name)) {
          return reply(withCrossSystemNote(heresy.text, heresyStamp(), `Found in Horus Heresy. 40K only has Legends datasheets of this name, such as ${fortyK.closest}.`));
        }
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
      // A unit's answer carries rulings that name it (faction rulings included: the name is specific).
      return reply(fortyK.text + (fortyK.score >= STRONG_MATCH
        ? attachRulings({ system: "40k", names: [fortyK.closest], army: faction, specific: true }) : ""));
    },
  );
}
