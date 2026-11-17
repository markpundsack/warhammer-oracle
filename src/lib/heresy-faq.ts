/**
 * Searching the Horus Heresy FAQ (src/data/heresy-faq.ts) by question.
 *
 * About fifty rulings; the scoring lives in faq-search.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HERESY_FAQ as WAHAPEDIA_FAQ } from "../data/heresy-faq.js";
import type { HeresyFaqEntry } from "../types.js";
import { normalizeForMatch, registerFaqSource } from "./faq-attach.js";
import { buildFaqSearch } from "./faq-search.js";
import { heresyStamp } from "./heresy-format.js";

/**
 * GW's own FAQ & Errata, when the deployment supplies it. Its terms are personal use only, so it is
 * never committed (src/data/private/ is gitignored): the deploy copies it in, and the Docker image
 * carries it to /app/private. Errata read as a question: "Errata: <rule>".
 */
function officialFaq(): HeresyFaqEntry[] {
  const here = dirname(fileURLToPath(import.meta.url));
  // HERESY_FAQ_OFFICIAL names the file, or "none" (the tests: they don't depend on a file outside git).
  const env = process.env.HERESY_FAQ_OFFICIAL;
  const file = env !== undefined ? (existsSync(env) ? env : undefined)
    : [join(here, "../../private/heresy-faq-official.json"), join(here, "../data/private/heresy-faq-official.json")]
        .find((p) => existsSync(p));
  if (!file) return [];
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as HeresyFaqEntry[];
  } catch {
    return [];
  }
}

const OFFICIAL = officialFaq();
const asked = new Set(OFFICIAL.map((e) => normalizeForMatch(e.question)));
// Wahapedia repeats many of GW's rulings; with GW's own text present, keep one copy.
const HERESY_FAQ: HeresyFaqEntry[] = [...OFFICIAL, ...WAHAPEDIA_FAQ.filter((e) => !asked.has(normalizeForMatch(e.question)))];
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
