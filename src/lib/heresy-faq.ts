/**
 * Searching the Horus Heresy FAQ (src/data/heresy-faq.ts) by question.
 *
 * About fifty rulings; the scoring lives in faq-search.ts.
 */
import { HERESY_FAQ } from "../data/heresy-faq.js";
import type { HeresyFaqEntry } from "../types.js";
import { buildFaqSearch } from "./faq-search.js";
import { heresyStamp } from "./heresy-format.js";

const search = buildFaqSearch(HERESY_FAQ, "heresy horus");

export function searchHeresyFaq(query: string, limit = 3): { entry: HeresyFaqEntry; score: number }[] {
  return search(query, limit);
}

/** FAQ rulings whose question names `ruleName` (e.g. "Vanguard (X)" → rulings about Vanguard). */
export function faqForRule(ruleName: string, limit = 2): HeresyFaqEntry[] {
  const base = ruleName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (base.length < 4) return [];
  const re = new RegExp(`\\b${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return HERESY_FAQ.filter((e) => re.test(e.question)).slice(0, limit);
}

export function formatFaqEntry(e: HeresyFaqEntry): string {
  return `**Q:** ${e.question}\n**A:** ${e.answer}\n_${e.source} — ${e.url}_`;
}

export function formatFaqSearch(query: string): string {
  const hits = searchHeresyFaq(query);
  if (!hits.length) {
    return `${heresyStamp()}\n\nNo Horus Heresy FAQ ruling matches "${query}". The FAQ has ${HERESY_FAQ.length} rulings; the rule itself may answer it (lookup_keyword with game_mode "heresy").`;
  }
  const best = hits[0].score;
  return [
    heresyStamp(),
    `# Horus Heresy FAQ: closest rulings to "${query}"`,
    ...hits.map((h, i) => `## ${i + 1}.${i === 0 && best >= 0.6 ? "" : " (possibly related)"}\n\n${formatFaqEntry(h.entry)}`),
    "_Official FAQ rulings. Answer from one only if it is clearly the same question._",
  ].join("\n\n");
}
