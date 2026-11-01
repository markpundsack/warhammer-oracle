import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KEYWORDS } from "../data/keywords.js";
import { SHARED_RULES } from "../data/rules.js";
import { HERESY_SPECIAL_RULES } from "../data/heresy-rules.js";
import { fuzzySearch, normalizeName } from "../lib/search.js";
import { findHeresyRules, formatHeresyRule, heresyStamp, splitRuleQuery, HERESY_LABEL } from "../lib/heresy-format.js";
import type { KeywordDefinition, GameMode } from "../types.js";

function formatCuratedKeyword(kw: KeywordDefinition): string {
  const sections: string[] = [];

  sections.push(`# ${kw.name}`);
  sections.push(`**Game Modes:** ${kw.gameModes.join(", ")}`);
  sections.push(`## Official Definition\n\n${kw.description}`);
  sections.push(`## Plain English\n\n${kw.plainEnglish}`);

  if (kw.examples && kw.examples.length > 0) {
    const exampleLines = kw.examples.map((e) => `- ${e}`);
    sections.push(`## Examples\n\n${exampleLines.join("\n")}`);
  }

  sections.push("> Reflects the Warhammer 40,000 11th Edition Core Rules.");

  return sections.join("\n\n");
}

function formatSharedRule(rule: { name: string; description: string }): string {
  const sections: string[] = [];

  sections.push(`# ${rule.name}`);
  sections.push(
    `*Source: rules data (BSData). A curated plain-English explanation is not yet available for this keyword.*`,
  );
  sections.push(`## Definition\n\n${rule.description}`);
  sections.push("> Reflects 10th Edition core rules; not yet updated for 11th Edition.");

  return sections.join("\n\n");
}

/**
 * Horus Heresy special rules, straight from BSData (full rule text). "Bulky
 * (6)", "bulky" and "Bulky (X)" all find "Bulky (X)"; a value in the query is
 * echoed back as X.
 */
function lookupHeresyRule(keyword: string): string {
  const matches = findHeresyRules(HERESY_SPECIAL_RULES, keyword);
  if (matches.length === 0) {
    const examples = ["Bulky (X)", "Rending (X)", "Deep Strike", "Feel No Pain (X)", "Breaching (X)"]
      .filter((n) => HERESY_SPECIAL_RULES.some((r) => r.name === n))
      .join(", ");
    return (
      `${heresyStamp()}\n\nNo ${HERESY_LABEL} special rule found matching "${keyword}".\n\n` +
      `Try a different spelling or the rule's base name${examples ? ` (e.g. ${examples})` : ""}.`
    );
  }
  const top = matches[0];
  const topBase = normalizeName(top.name.replace(/\s*\([^)]*\)\s*$/, ""));
  const related = matches.slice(1, 6).filter((r) => normalizeName(r.name).includes(topBase) || topBase.includes(normalizeName(r.name)));
  let text = formatHeresyRule(top, keyword, related);
  const base = splitRuleQuery(top.name).base;
  if (KEYWORDS.some((kw) => normalizeName(kw.name) === base)) {
    text += `\n\n_A Warhammer 40,000 keyword with this name also exists; it belongs to a different game. This is the ${HERESY_LABEL} rule._`;
  }
  return text;
}

export function registerLookupKeyword(server: McpServer): void {
  server.tool(
    "lookup_keyword",
    "Look up a Warhammer 40K keyword or rule, or a Horus Heresy (3rd edition, '30K') special rule with game_mode 'heresy'. " +
      "Returns the official definition, a plain English explanation, examples, and applicable game modes " +
      "(Horus Heresy: the rule's full text from the data).",
    {
      keyword: z
        .string()
        .describe(
          "Name or partial name of the keyword to look up (e.g. 'Devastating Wounds', 'Feel No Pain'; " +
            "Horus Heresy: 'Bulky (6)', 'Rending', 'Deep Strike')",
        ),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team", "heresy"])
        .optional()
        .describe(
          "Optional game mode filter — only show keywords applicable to this mode. " +
            "'heresy' looks up Horus Heresy 3rd edition special rules instead of 40K keywords.",
        ),
    },
    async ({ keyword, game_mode }) => {
      if (game_mode === "heresy") {
        return { content: [{ type: "text" as const, text: lookupHeresyRule(keyword) }] };
      }

      // 1. Search curated KEYWORDS first (fuzzy match on name)
      const allCuratedMatches = fuzzySearch(KEYWORDS, keyword, ["name"]);

      if (allCuratedMatches.length > 0) {
        // Apply game_mode filter if provided
        const filtered = game_mode
          ? allCuratedMatches.filter((kw) =>
              kw.gameModes.includes(game_mode as GameMode),
            )
          : allCuratedMatches;

        if (filtered.length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: formatCuratedKeyword(filtered[0]),
              },
            ],
          };
        }

        // Keyword exists in curated list but not for this game mode
        return {
          content: [
            {
              type: "text" as const,
              text: `Keyword "${keyword}" was found but is not applicable to ${game_mode}.\n\nIt applies to: ${allCuratedMatches[0].gameModes.join(", ")}.`,
            },
          ],
        };
      }

      // 2. Fall back to SHARED_RULES (no game_mode filter — rules data doesn't have mode info)
      const ruleMatches = fuzzySearch(SHARED_RULES, keyword, ["name"]);

      if (ruleMatches.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatSharedRule(ruleMatches[0]),
            },
          ],
        };
      }

      // 3. Not found anywhere
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Keyword "${keyword}" not found in the curated keywords or rules data.\n\nTry a different spelling or a partial name. Some keywords include: Devastating Wounds, Lethal Hits, Feel No Pain, Deep Strike, Invulnerable Save.` +
              (findHeresyRules(HERESY_SPECIAL_RULES, keyword, 0.82).length > 0
                ? `\n\n_"${keyword}" matches a ${HERESY_LABEL} special rule; ask with game_mode "heresy" for it._`
                : ""),
          },
        ],
      };
    },
  );
}
