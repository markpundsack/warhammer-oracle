import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { UNITS } from "../data/units.js";
import { UNITS_11E } from "../data/units-11e.js";
import { KILL_TEAM_OPERATIVES } from "../data/kill-team-operatives.js";
import { HERESY_UNITS, HERESY_FACTIONS } from "../data/heresy-units.js";
import { fuzzySearch, normalizeName, rankByName } from "../lib/search.js";
import { formatHeresyUnit, heresyContentKey, heresyStamp, HERESY_LABEL } from "../lib/heresy-format.js";
import { rankUnitMatches, ambiguousFactionMatches, datasheetContentKey } from "../lib/unit-match.js";
import { formatModeStamp, formatUnitSize } from "../lib/format.js";
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

  // Stats
  sections.push(`### Unit Profiles\n\n${formatStatsTable(unit.profiles)}`);

  // Weapons
  const ranged = formatRangedWeapons(unit.rangedWeapons);
  if (ranged) sections.push(ranged);

  const melee = formatMeleeWeapons(unit.meleeWeapons);
  if (melee) sections.push(melee);

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

// === Horus Heresy ===

const HERESY_UNIT_NAMES = new Set(HERESY_UNITS.map((u) => normalizeName(u.name)));
const UNIT_NAMES_40K = new Set([...UNITS_11E, ...UNITS].map((u) => normalizeName(u.name)));

/** A one-line pointer to the other game, only when a datasheet of exactly this name exists there. */
function heresyHint(name: string): string {
  return HERESY_UNIT_NAMES.has(normalizeName(name))
    ? `\n\n_"${name}" is also a ${HERESY_LABEL} unit; ask with game_mode "heresy" for that datasheet._`
    : "";
}

function fortyKHint(name: string): string {
  return UNIT_NAMES_40K.has(normalizeName(name))
    ? `\n\n_"${name}" is also a Warhammer 40,000 unit name; ask with game_mode "40k" for the 40K datasheet._`
    : "";
}

function lookupHeresyUnit(unitName: string, faction?: string, datasheetId?: string): string {
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
    return (
      `${heresyStamp()}\n\nNo ${HERESY_LABEL} unit found matching "${unitName}".` +
      `${faction ? ` (faction filter: "${faction}")` : ""}${datasheetId ? ` (datasheet_id: "${datasheetId}")` : ""}\n\n` +
      `Try a partial name or check the spelling. Note: Legion units are named without "Legion" (e.g. "Tactical Squad").` +
      fortyKHint(unitName)
    );
  }

  // Same-name datasheets: identical copies (e.g. each Legion's own "Inductii
  // Squad") collapse to one; genuinely different ones need a faction.
  const top = ranked[0].item;
  const sameName = ranked.map((r) => r.item).filter((u) => normalizeName(u.name) === normalizeName(top.name));
  const contents = new Map<string, HeresyUnit[]>();
  for (const u of sameName) contents.set(heresyContentKey(u), [...(contents.get(heresyContentKey(u)) ?? []), u]);
  if (contents.size > 1 && ranked[0].score >= 0.9) {
    const options = [...contents.values()].map((group) => group[0]);
    const lines = options.map((o) => `- **${o.name}** (${o.faction}) — datasheet_id: \`${o.id}\``);
    return (
      `${heresyStamp()}\n\n"${top.name}" is more than one ${HERESY_LABEL} datasheet with different stats, weapons, rules or points. ` +
      `Re-run \`lookup_unit\` with game_mode "heresy" and the \`faction\` (or \`datasheet_id\`) set to one of:\n\n${lines.join("\n")}`
    );
  }
  const alsoIn = (contents.get(heresyContentKey(top)) ?? []).filter((u) => u !== top).map((u) => u.faction);
  return formatHeresyUnit(top, HERESY_FACTIONS, alsoIn) + fortyKHint(top.name);
}

// === Tool Registration ===

export function registerLookupUnit(server: McpServer): void {
  server.tool(
    "lookup_unit",
    "Look up a Warhammer 40K unit, Kill Team operative, or Horus Heresy (3rd edition, '30K') unit datasheet by name. " +
      "Returns stats, weapons, abilities/special rules, and keywords. Use game_mode 'heresy' for Horus Heresy.",
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
        return { content: [{ type: "text" as const, text: lookupHeresyUnit(unit_name, faction, datasheet_id) }] };
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
      let candidates: Unit[] = [...(gameSystem === "wh40k-10e" ? UNITS : UNITS_11E)];

      if (faction) {
        candidates = fuzzySearch(candidates, faction, ["faction"]);
      }
      if (datasheet_id) candidates = candidates.filter((unit) => unit.id === datasheet_id);

      const matches = rankUnitMatches(candidates, unit_name, datasheetContentKey);

      if (matches.length === 0) {
        const suggestion = faction
          ? `Try a different faction or check the spelling.`
          : `Try a partial name or check the spelling.`;
        return {
          content: [
            {
              type: "text" as const,
              text: `No unit found matching "${unit_name}".${faction ? ` (faction filter: "${faction}")` : ""}${datasheet_id ? ` (datasheet_id: "${datasheet_id}")` : ""}\n\n${suggestion}${heresyHint(unit_name)}`,
            },
          ],
        };
      }

      const ambiguous = ambiguousFactionMatches(matches, unit_name, datasheetContentKey);
      if (ambiguous) {
        return {
          content: [
            { type: "text" as const, text: formatFactionDisambiguation(matches[0].name, ambiguous) },
          ],
        };
      }

      const unit = matches[0];
      return {
        content: [
          {
            type: "text" as const,
            text: `${formatModeStamp(gameSystem)}\n\n${formatUnit(unit)}${heresyHint(unit.name) || heresyHint(unit_name)}`,
          },
        ],
      };
    },
  );
}
