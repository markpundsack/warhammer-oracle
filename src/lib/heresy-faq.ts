/**
 * Searching the Horus Heresy FAQ (src/data/heresy-faq.ts) by question.
 *
 * About fifty rulings; the scoring lives in faq-search.ts.
 */
import { HERESY_FAQ } from "../data/heresy-faq.js";
import type { HeresyFaqEntry } from "../types.js";
import { normalizeForMatch, registerFaqSource } from "./faq-attach.js";
import { buildFaqSearch } from "./faq-search.js";
import { heresyStamp } from "./heresy-format.js";

const search = buildFaqSearch(HERESY_FAQ, "heresy horus");

export function searchHeresyFaq(query: string, limit = 3): { entry: HeresyFaqEntry; score: number }[] {
  return search(query, limit);
}

export function formatFaqEntry(e: HeresyFaqEntry): string {
  return `**Q:** ${e.question}\n**A:** ${e.answer}\n_${e.source} — ${e.url}_`;
}

/** "Mechanicum (Forces of the Taghmata) FAQ" → "mechanicum"; the core "Horus Heresy FAQ" → undefined. */
function faqArmy(e: HeresyFaqEntry): string | undefined {
  if (e.source === "Horus Heresy FAQ") return undefined;
  return e.source.replace(/\s*FAQ$/, "").replace(/\s*\(.*\)$/, "");
}

// Heresy rulings can come along with any Heresy lookup's answer (src/lib/faq-attach.ts).
registerFaqSource("heresy", {
  // Only rulings whose question names it: answers mention things in passing ("bayonets" in a Line of Sight ruling)
  search: (query, limit) => {
    const stem = normalizeForMatch(query).replace(/(ing|s)$/, "");
    return search(query, limit).filter((h) => normalizeForMatch(h.entry.question).includes(stem));
  },
  army: faqArmy,
  sameArmy: (e: HeresyFaqEntry, army: string) => {
    const a = army.toLowerCase();
    const mine = faqArmy(e)?.toLowerCase() ?? "";
    return !!mine && (a.includes(mine) || mine.includes(a));
  },
  format: formatFaqEntry,
});

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
