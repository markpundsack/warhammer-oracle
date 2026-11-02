import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KEYWORDS } from "../data/keywords.js";
import { SHARED_RULES } from "../data/rules.js";
import { HERESY_SPECIAL_RULES } from "../data/heresy-rules.js";
import { STRATAGEMS } from "../data/stratagems.js";
import { HERESY_NAMED_RULES, HERESY_RULE_CORPUS } from "../lib/heresy-corpus.js";
import { fuzzySearch, normalizeName, scoreName } from "../lib/search.js";
import { otherGamePointer, shouldCrossOver, withCrossSystemNote } from "../lib/cross-system.js";
import { findHeresyRules, formatHeresyRule, heresyStamp, scoreHeresyRule, splitRuleQuery, HERESY_LABEL } from "../lib/heresy-format.js";
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

/** A lookup's response, how well its best match names the query (0 when nothing matched), and that match's name. */
type LookupResult = { text: string; score: number; closest?: string };

/** "Feel No Pain (5+)" → "Feel No Pain": 40K keyword names carry no value. */
function withoutValue(keyword: string): string {
  return keyword.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Best match first; ties keep data order. */
function byScore<T extends { name: string }>(items: T[], query: string): T[] {
  return items
    .map((item) => ({ item, score: scoreName(query, item.name) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

/**
 * Horus Heresy special rules, straight from BSData (full rule text). "Bulky
 * (6)", "bulky" and "Bulky (X)" all find "Bulky (X)"; a value in the query is
 * echoed back as X.
 */
function lookupHeresyRule(keyword: string, corpus = HERESY_RULE_CORPUS): LookupResult {
  const matches = findHeresyRules(corpus, keyword);
  if (matches.length === 0) {
    const examples = ["Bulky (X)", "Rending (X)", "Deep Strike", "Feel No Pain (X)", "Breaching (X)"]
      .filter((n) => HERESY_SPECIAL_RULES.some((r) => r.name === n))
      .join(", ");
    return {
      score: 0,
      text:
        `${heresyStamp()}\n\nNo ${HERESY_LABEL} rule found matching "${keyword}".\n\n` +
        `Try a different spelling or the rule's base name${examples ? ` (e.g. ${examples})` : ""}.`,
    };
  }
  const top = matches[0];
  const topBase = normalizeName(top.name.replace(/\s*\([^)]*\)\s*$/, ""));
  const related = matches.slice(1, 6).filter((r) => normalizeName(r.name).includes(topBase) || topBase.includes(normalizeName(r.name)));
  let text = formatHeresyRule(top, keyword, related);
  const base = splitRuleQuery(top.name).base;
  if (KEYWORDS.some((kw) => normalizeName(kw.name) === base)) {
    text += `\n\n_"${top.name}" is also a 40K keyword; ask with game_mode "40k" for that rule._`;
  }
  return { text, score: scoreHeresyRule(top, keyword), closest: top.name };
}

/** One-line pointer when a Horus Heresy rule of this name also exists. */
function heresyRuleHint(name: string): string {
  const [top] = findHeresyRules(HERESY_SPECIAL_RULES, name, 0.95);
  return top ? `\n\n_"${name}" is also a ${HERESY_LABEL} special rule; ask with game_mode "heresy" for it._` : "";
}

function lookup40kKeyword(keyword: string, gameMode: GameMode | undefined): LookupResult {
  // 1. Curated KEYWORDS first (substring match on name, best name match first).
  //    A value in the query ("Feel No Pain (5+)") is dropped if the full text finds nothing.
  let query = keyword;
  let allCuratedMatches = byScore(fuzzySearch(KEYWORDS, query, ["name"]), query);
  let ruleMatches = allCuratedMatches.length > 0 ? [] : byScore(fuzzySearch(SHARED_RULES, query, ["name"]), query);
  if (allCuratedMatches.length === 0 && ruleMatches.length === 0 && withoutValue(keyword) && withoutValue(keyword) !== keyword) {
    query = withoutValue(keyword);
    allCuratedMatches = byScore(fuzzySearch(KEYWORDS, query, ["name"]), query);
    ruleMatches = allCuratedMatches.length > 0 ? [] : byScore(fuzzySearch(SHARED_RULES, query, ["name"]), query);
  }

  if (allCuratedMatches.length > 0) {
    // Apply game_mode filter if provided
    const filtered = gameMode ? allCuratedMatches.filter((kw) => kw.gameModes.includes(gameMode)) : allCuratedMatches;
    const top = filtered[0] ?? allCuratedMatches[0];
    const score = scoreName(query, top.name);
    if (filtered.length > 0) {
      return { score, closest: top.name, text: formatCuratedKeyword(top) + heresyRuleHint(top.name) };
    }
    // Keyword exists in curated list but not for this game mode
    return {
      score,
      closest: top.name,
      text: `Keyword "${keyword}" was found but is not applicable to ${gameMode}.\n\nIt applies to: ${top.gameModes.join(", ")}.`,
    };
  }

  // 2. Fall back to SHARED_RULES (no game_mode filter — rules data doesn't have mode info)
  if (ruleMatches.length > 0) {
    const top = ruleMatches[0];
    return { score: scoreName(query, top.name), closest: top.name, text: formatSharedRule(top) + heresyRuleHint(top.name) };
  }

  // 3. Not found anywhere
  return {
    score: 0,
    text:
      `Keyword "${keyword}" not found in the curated keywords or rules data.\n\nTry a different spelling or a partial name. Some keywords include: Devastating Wounds, Lethal Hits, Feel No Pain, Deep Strike, Invulnerable Save.`,
  };
}

/**
 * A 40K stratagem whose name contains the query as whole words ("Overwatch" →
 * "Fire Overwatch", "Heroic Intervention"). Those are 40K questions even
 * though lookup_keyword has no 40K keyword for them, so a no-game_mode
 * question must not be answered from Heresy.
 */
function fortyKStratagemNamed(keyword: string): string | undefined {
  const q = normalizeName(keyword);
  if (!q) return undefined;
  const re = new RegExp(`(^| )${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);
  return STRATAGEMS.find((s) => re.test(normalizeName(s.name)))?.name;
}

export function registerLookupKeyword(server: McpServer): void {
  server.tool(
    "lookup_keyword",
    "Look up a Warhammer 40K keyword or rule, or any Horus Heresy (3rd edition, '30K') rule with game_mode 'heresy': " +
      "special rules, Reactions (core and advanced), Gambits and challenges, Statuses (Pinned, Suppressed, Stunned, Routed), " +
      "phases and sub-phases, psychic powers, wargear, battlefield assets, detachments and the Crusade Force Organisation Chart, " +
      "and the core missions (deployment maps, objectives, mission special rules). " +
      "Returns the official definition, a plain English explanation, examples, and applicable game modes " +
      "(Horus Heresy: the rule's full text).",
    {
      keyword: z
        .string()
        .describe(
          "Name or partial name of the keyword to look up (e.g. 'Devastating Wounds', 'Feel No Pain'; " +
            "Horus Heresy: 'Bulky (6)', 'Rending', 'Deep Strike', 'Return Fire', 'Pinned', 'Flurry of Blows', 'Charge Sub-Phase', " +
            "'Crusade Primary Detachment', 'Hammer and Anvil')",
        ),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team", "heresy"])
        .optional()
        .describe(
          "Optional game mode filter — only show keywords applicable to this mode. " +
            "'heresy' looks up Horus Heresy 3rd edition rules instead of 40K keywords.",
        ),
    },
    async ({ keyword, game_mode }) => {
      const reply = (text: string) => ({ content: [{ type: "text" as const, text }] });

      if (game_mode === "heresy") {
        const heresy = lookupHeresyRule(keyword);
        // Explicit game_mode: never substitute 40K, but point at a clear 40K match.
        const fortyK = lookup40kKeyword(keyword, undefined);
        if (shouldCrossOver(heresy.score, fortyK.score)) {
          return reply(withCrossSystemNote(heresy.text, heresyStamp(), otherGamePointer("40k", fortyK.closest!)));
        }
        return reply(heresy.text);
      }

      const fortyK = lookup40kKeyword(keyword, game_mode as GameMode | undefined);
      const heresy = lookupHeresyRule(keyword, HERESY_NAMED_RULES);
      if (shouldCrossOver(fortyK.score, heresy.score)) {
        // No game_mode: no good 40K match but a clear Heresy rule answers from Heresy.
        if (game_mode === undefined) {
          const stratagem = fortyKStratagemNamed(keyword);
          if (stratagem) {
            return reply(
              withCrossSystemNote(
                fortyK.text,
                "",
                `In 40K this is the "${stratagem}" stratagem (lookup_stratagem). Horus Heresy has "${heresy.closest}" (game_mode "heresy").`,
              ),
            );
          }
          const closest = fortyK.score >= 0.55 ? ` Closest 40K keyword: ${fortyK.closest}.` : "";
          return reply(withCrossSystemNote(heresy.text, heresyStamp(), `Found in Horus Heresy, not 40K.${closest}`));
        }
        // Explicit 40K mode: keep the 40K answer, add a pointer.
        if (game_mode === "40k") return reply(withCrossSystemNote(fortyK.text, "", otherGamePointer("heresy", heresy.closest!)));
      }
      return reply(fortyK.text);
    },
  );
}
