import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KEYWORDS } from "../data/keywords.js";
import { SHARED_RULES_11E } from "../data/rules-11e.js";
import { CORE_RULES_11E, CORE_STRATAGEM_REFS, type CoreRule } from "../data/core-rules-11e.js";
import { UNITS_11E } from "../data/units-11e.js";
import { HERESY_SPECIAL_RULES } from "../data/heresy-rules.js";
import { STRATAGEMS } from "../data/stratagems.js";
import { formatStratagem } from "./lookup-stratagem.js";
import { findHeresyRuleMentioning, HERESY_NAMED_RULES, HERESY_RULE_CORPUS } from "../lib/heresy-corpus.js";
import { faqForRule, formatFaqEntry } from "../lib/heresy-faq.js";
import { fuzzySearch, normalizeName, rankByName, scoreName } from "../lib/search.js";
import { shouldCrossOver, STRONG_MATCH, withCrossSystemNote } from "../lib/cross-system.js";
import { findHeresyRules, formatHeresyRule, heresyStamp, scoreHeresyRule, splitRuleQuery, HERESY_LABEL } from "../lib/heresy-format.js";
import type { KeywordDefinition, GameMode } from "../types.js";
import { faqFor } from "../lib/faq-11e.js";

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
  sections.push("> Reflects the Warhammer 40,000 11th Edition rules data.");

  return sections.join("\n\n");
}

/** Weakest name match worth answering with: every query word appears in the name (see `scoreName`). */
const MIN_RULE_MATCH = 0.6;

const CORE_RULE_LABELS = CORE_RULES_11E.flatMap((rule) => [
  { rule, label: rule.name, isAlias: false },
  { rule, label: rule.ruleRef, isAlias: true },
  ...rule.aliases.map((label) => ({ rule, label, isAlias: true })),
]);

/**
 * Core rules matching the query by name or alias, best first. A one-word query
 * must match an alias whole: aliases are often phrases, and "Overwatch" must not
 * find a rule just because an alias starts with that word.
 */
function findCoreRules(query: string): { rule: CoreRule; score: number }[] {
  const oneWord = !normalizeName(query).includes(" ");
  const best = new Map<CoreRule, number>();
  for (const { item, score } of rankByName(CORE_RULE_LABELS, query, (l) => l.label, MIN_RULE_MATCH)) {
    if (oneWord && item.isAlias && score < 0.95) continue;
    if (!best.has(item.rule)) best.set(item.rule, score);
  }
  return [...best].map(([rule, score]) => ({ rule, score }));
}

function formatCoreRule(rule: CoreRule, related: CoreRule[]): string {
  const ref = /^\d/.test(rule.ruleRef) ? `Core Rules ${rule.ruleRef}` : rule.ruleRef;
  const sections = [
    `# ${rule.name}`,
    `**${ref}** (Warhammer 40,000 11th Edition)`,
    rule.summary,
  ];
  if (related.length > 0) {
    sections.push(`Related: ${related.map((r) => `${r.name} (${r.ruleRef})`).join("; ")}.`);
  }
  return sections.join("\n\n");
}

interface ArmyRuleVariant {
  description: string;
  factions: Set<string>;
  units: Set<string>;
  /** Units outside Legends, whose factions are the ones to name: a Legends datasheet can be listed under unrelated factions. */
  currentFactions: Set<string>;
}

interface ArmyRule {
  name: string;
  unitCount: number;
  variants: ArmyRuleVariant[];
}

/** Datasheet markup, which a voice assistant would read aloud, and the blank-line runs left around it. */
function cleanAbilityText(text: string): string {
  return text
    .replace(/\^\^|\*\*/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

let armyRuleIndex: ArmyRule[] | undefined;

/** Every datasheet ability, one entry per name with identical wordings merged. Built on first use (6,000+ units). */
function armyRules(): ArmyRule[] {
  if (armyRuleIndex) return armyRuleIndex;
  const byName = new Map<string, { name: string; unitCount: number; variants: Map<string, ArmyRuleVariant> }>();
  for (const unit of UNITS_11E) {
    for (const ability of unit.abilities) {
      const key = normalizeName(ability.name);
      if (!key) continue;
      let entry = byName.get(key);
      if (!entry) byName.set(key, (entry = { name: ability.name, unitCount: 0, variants: new Map() }));
      entry.unitCount++;
      const description = cleanAbilityText(ability.description);
      let variant = entry.variants.get(description);
      if (!variant) entry.variants.set(description, (variant = { description, factions: new Set(), units: new Set(), currentFactions: new Set() }));
      variant.factions.add(unit.faction);
      variant.units.add(unit.name);
      if (!/\[Legends\]/.test(unit.name)) variant.currentFactions.add(unit.faction);
    }
  }
  armyRuleIndex = [...byName.values()].map((e) => ({
    name: e.name,
    unitCount: e.unitCount,
    variants: [...e.variants.values()].sort((a, b) => b.units.size - a.units.size),
  }));
  return armyRuleIndex;
}

/** "Adeptus Astartes - Ultramarines", ... → "Adeptus Astartes (all chapters listed: 12)"; long lists are cut short. */
function factionList(factions: Iterable<string>): string {
  const names = [...factions];
  const chapters = names.filter((f) => f.startsWith("Adeptus Astartes - "));
  const grouped = chapters.length > 1
    ? [`Adeptus Astartes (${chapters.length} chapter lists)`, ...names.filter((f) => !chapters.includes(f))]
    : names;
  return grouped.length > 6 ? `${grouped.slice(0, 6).join(", ")} and ${grouped.length - 6} more` : grouped.join(", ");
}

function variantFactions(variant: ArmyRuleVariant): Set<string> {
  return variant.currentFactions.size > 0 ? variant.currentFactions : variant.factions;
}

/** Who a wording is for: the unit, when only a couple of datasheets in one faction have it. */
function variantLabel(variant: ArmyRuleVariant): string {
  const factions = variantFactions(variant);
  return factions.size === 1 && variant.units.size <= 2
    ? `${[...variant.units].join(", ")} (${factionList(factions)})`
    : factionList(factions);
}

function formatArmyRule(rule: ArmyRule): string {
  const sections = [`# ${rule.name}`];
  if (rule.variants.length === 1) {
    const [only] = rule.variants;
    sections.push(`**Army rule or datasheet ability.** Factions: ${factionList(variantFactions(only))}.`, only.description);
  } else {
    sections.push(`**Datasheet ability, worded differently across units.**`);
    for (const variant of rule.variants.slice(0, 3)) sections.push(`**${variantLabel(variant)}:** ${variant.description}`);
    if (rule.variants.length > 3) sections.push(`Plus ${rule.variants.length - 3} other wordings; ask about the unit for its own version.`);
  }
  sections.push("> From the Warhammer 40,000 11th Edition datasheets.");
  return sections.join("\n\n");
}

/** Letter runs squeezed, so a transcriber's "Waagh" or "Waaaagh" still finds "Waaagh!". */
function squeezeRepeats(s: string): string {
  return normalizeName(s).replace(/(.)\1+/g, "$1");
}

/** A named army rule or other datasheet ability ("Combat Doctrines", "Waaagh!"), across every unit. */
function lookupArmyRule(keyword: string): LookupResult | undefined {
  const squeezed = squeezeRepeats(keyword);
  const scored = armyRules()
    .map((rule) => ({
      rule,
      score: squeezeRepeats(rule.name) === squeezed ? Math.max(0.95, scoreName(keyword, rule.name)) : scoreName(keyword, rule.name),
    }))
    .filter((r) => r.score >= MIN_RULE_MATCH)
    .sort((a, b) => b.score - a.score || b.rule.unitCount - a.rule.unitCount);
  const top = scored[0];
  if (!top) return undefined;
  let text = formatArmyRule(top.rule);
  // A loose match may not be the rule that was meant, so say what else it could be.
  if (top.score < STRONG_MATCH && scored.length > 1) {
    text += `\n\nSimilar names: ${scored.slice(1, 4).map((r) => r.rule.name).join(", ")}.`;
  }
  return { text, score: top.score, closest: top.rule.name };
}

/** A lookup's response, how well its best match names the query (0 when nothing matched), and that match's name. */
type LookupResult = { text: string; score: number; closest?: string };

/** "Feel No Pain (5+)" or "Feel No Pain 5+" → "Feel No Pain": 40K keyword names carry no value. */
function withoutValue(keyword: string): string {
  return keyword
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\]\s*$/, "")
    .replace(/^\s*\[/, "")
    .replace(/\s+(?:D?\d+(?:\+|")?|X\+?)\s*$/i, "")
    .trim();
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
  if (matches.length === 0 && corpus === HERESY_RULE_CORPUS) {
    // Explicit Heresy mode only: a term that's used in rule text but isn't a rule's name ("snap shots").
    const mentioning = findHeresyRuleMentioning(keyword);
    if (mentioning) {
      const text = formatHeresyRule(mentioning, keyword);
      return {
        text: withCrossSystemNote(text, heresyStamp(), `No Heresy rule is named "${keyword}"; this is the rule that mentions it most. Check it answers the question.`),
        score: 0.5,
        closest: mentioning.name,
      };
    }
  }
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
  const rulings = faqForRule(top.name);
  if (rulings.length) text += `\n\n### FAQ\n\n${rulings.map(formatFaqEntry).join("\n\n")}`;
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

/** Core rules are for 40K and Combat Patrol, and Horus Heresy questions don't get them as a stand-in. */
function lookup40kKeyword(keyword: string, gameMode: GameMode | undefined, { coreRules = true } = {}): LookupResult {
  // 1. Curated KEYWORDS first (substring match on name, best name match first).
  //    A value in the query ("Feel No Pain (5+)") is dropped if the full text finds nothing,
  //    and is tried against the keywords before the rules data ("Feel No Pain 5+" is in both).
  // "Anti-Infantry 4+" is how weapons name it; the keyword is "Anti-X".
  if (/^\s*anti[- ][a-z]/i.test(keyword)) keyword = "Anti-X";
  const bare = withoutValue(keyword);
  let query = keyword;
  let allCuratedMatches = byScore(fuzzySearch(KEYWORDS, query, ["name"]), query);
  if (allCuratedMatches.length === 0 && bare && bare !== keyword) {
    const bareMatches = byScore(fuzzySearch(KEYWORDS, bare, ["name"]), bare);
    if (bareMatches.length > 0) {
      allCuratedMatches = bareMatches;
      query = bare;
    }
  }
  let ruleMatches = allCuratedMatches.length > 0 ? [] : byScore(fuzzySearch(SHARED_RULES_11E, query, ["name"]), query);
  if (allCuratedMatches.length === 0 && ruleMatches.length === 0 && bare && bare !== keyword) {
    query = bare;
    ruleMatches = byScore(fuzzySearch(SHARED_RULES_11E, query, ["name"]), query);
  }

  // Core rules, with a better match than the keywords' substring search ("hazard" is the Hazard Rolls
  // rule rather than Hazardous). A keyword of the same quality wins, since it has the fuller explanation;
  // against the rules data the core rule wins a tie, for its rule number and plain wording.
  if (coreRules && gameMode !== "kill_team") {
    let core = findCoreRules(keyword);
    if (core.length === 0 && bare && bare !== keyword) core = findCoreRules(bare);
    const top = core[0];
    const curatedScore = allCuratedMatches[0] ? scoreName(query, allCuratedMatches[0].name) : 0;
    const rulesDataScore = ruleMatches[0] ? scoreName(query, ruleMatches[0].name) : 0;
    if (top && top.score > curatedScore && top.score >= rulesDataScore) {
      const related = core.slice(1, 4).map((r) => r.rule);
      return { score: top.score, closest: top.rule.name, text: formatCoreRule(top.rule, related) + heresyRuleHint(top.rule.name) };
    }
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

  // 2. Fall back to SHARED_RULES_11E (no game_mode filter — rules data doesn't have mode info)
  if (ruleMatches.length > 0) {
    const top = ruleMatches[0];
    return { score: scoreName(query, top.name), closest: top.name, text: formatSharedRule(top) + heresyRuleHint(top.name) };
  }

  // 3. Not found anywhere
  return {
    score: 0,
    text:
      `Keyword "${keyword}" not found in the curated keywords, core rules or rules data.\n\nTry a different spelling or a partial name. Some keywords include: Devastating Wounds, Lethal Hits, Feel No Pain, Deep Strike, Invulnerable Save.`,
  };
}

/**
 * A 40K stratagem whose name contains the query as whole words ("Overwatch" →
 * "Fire Overwatch", "Heroic Intervention"). Those are 40K questions even
 * though lookup_keyword has no 40K keyword for them, so a no-game_mode
 * question must not be answered from Heresy.
 */
function fortyKStratagemNamed(keyword: string) {
  const q = normalizeName(keyword);
  if (!q) return undefined;
  const re = new RegExp(`(^| )${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);
  const named = STRATAGEMS.filter((s) => re.test(normalizeName(s.name)));
  // The core stratagem, when there is one, over any faction's.
  return named.find((s) => s.faction === "Core") ?? named[0];
}

export function registerLookupKeyword(server: McpServer): void {
  server.tool(
    "lookup_keyword",
    "Look up any Warhammer 40K rule by name: weapon and core abilities, every core rule with its rule number " +
      "(moves such as Advance, Fall Back and Emergency Disembark; coherency, engagement, visibility, mortal wounds, hazard rolls, battle-shock, " +
      "the attack sequence, shooting types, overrun fights, terrain and cover, objectives, stratagem and action rules, " +
      "monsters and vehicles, transports, attached units, strategic reserves, flying, auras, aircraft), " +
      "and army rules and datasheet abilities with the factions that have them (Combat Doctrines, Waaagh!, For The Greater Good). " +
      "Also any Horus Heresy (3rd edition, '30K') rule with game_mode 'heresy': " +
      "special rules, Reactions (core and advanced), Gambits and challenges, Statuses (Pinned, Suppressed, Stunned, Routed), " +
      "phases and sub-phases, psychic powers, wargear, battlefield assets, detachments and the Crusade Force Organisation Chart, " +
      "and the core missions (deployment maps, objectives, mission special rules). " +
      "Returns the official definition, a plain English explanation, examples, and applicable game modes " +
      "(Horus Heresy: the rule's full text).",
    {
      keyword: z
        .string()
        .describe(
          "Name or partial name of the keyword or rule to look up (e.g. 'Devastating Wounds', 'Feel No Pain', " +
            "'Emergency Disembark', 'Advance', 'Benefit of Cover', 'Combat Doctrines', 'Waaagh!'; " +
            "Horus Heresy: 'Bulky (6)', 'Rending', 'Deep Strike', 'Return Fire', 'Pinned', 'Flurry of Blows', 'Charge Sub-Phase', " +
            "'Crusade Primary Detachment', 'Hammer and Anvil')",
        ),
      game_mode: z
        .enum(["40k", "combat_patrol", "kill_team", "heresy"])
        .optional()
        .describe(
          "Optional game mode filter — only show keywords applicable to this mode (core rules and army rules are 40K and Combat Patrol). " +
            "'heresy' looks up Horus Heresy 3rd edition rules instead of 40K keywords.",
        ),
    },
    async ({ keyword, game_mode }) => {
      const reply = (text: string) => ({ content: [{ type: "text" as const, text }] });

      if (game_mode === "heresy") {
        const heresy = lookupHeresyRule(keyword);
        // Explicit game_mode: never substitute 40K, but point at a clear 40K match.
        const fortyK = lookup40kKeyword(keyword, undefined, { coreRules: false });
        if (shouldCrossOver(heresy.score, fortyK.score)) {
          // Answer with the rule, labelled: a voice model reads a bare pointer aloud instead of following it.
          return reply(withCrossSystemNote(fortyK.text, "", `Not in Horus Heresy. This is the Warhammer 40,000 rule.`));
        }
        return reply(heresy.text);
      }

      // 40K answers carry any official ruling about that rule, so one lookup is enough.
      const withFaq = (text: string, name?: string) => text + faqFor(name || keyword);
      const fortyK = lookup40kKeyword(keyword, game_mode as GameMode | undefined);
      const heresy = lookupHeresyRule(keyword, HERESY_NAMED_RULES);
      // Army rules and other datasheet abilities come after the keywords and core rules.
      const army = fortyK.score < STRONG_MATCH && game_mode !== "kill_team" ? lookupArmyRule(keyword) : undefined;
      // A 40K stratagem term ("Overwatch" → Fire Overwatch) is a 40K question: answer with the stratagem itself.
      if (fortyK.score < STRONG_MATCH && (game_mode === undefined || game_mode === "40k")) {
        const stratagem = fortyKStratagemNamed(keyword);
        // An ability named exactly this beats a stratagem that only contains the term.
        const namedExactly = stratagem && normalizeName(stratagem.name) === normalizeName(keyword);
        if (army && army.score >= 0.95 && !namedExactly) return reply(withFaq(army.text));
        if (stratagem) {
          const also = heresy.score >= STRONG_MATCH ? ` Horus Heresy also has "${heresy.closest}" (game_mode "heresy").` : "";
          const ref = stratagem.faction === "Core" ? CORE_STRATAGEM_REFS[stratagem.name] : undefined;
          return reply(withFaq(withCrossSystemNote(formatStratagem(stratagem), "", `This is a Warhammer 40,000 stratagem${ref ? ` (Core Rules ${ref})` : ""}.${also}`), stratagem.name));
        }
      }
      if (shouldCrossOver(fortyK.score, heresy.score)) {
        // No clear 40K match but a clear Heresy rule: answer with the rule, labelled. Also under an explicit
        // game_mode "40k", because a voice model reads a bare pointer aloud instead of following it.
        if (game_mode === undefined || game_mode === "40k") {
          const closest = game_mode === undefined && fortyK.score >= 0.55 ? ` Closest 40K keyword: ${fortyK.closest}.` : "";
          return reply(withCrossSystemNote(heresy.text, heresyStamp(), `Found in Horus Heresy, not 40K.${closest}`));
        }
      }
      if (army && army.score > fortyK.score) return reply(withFaq(army.text));
      return reply(withFaq(fortyK.text, fortyK.closest));
    },
  );
}
