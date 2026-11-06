/**
 * Searching the Horus Heresy FAQ (src/data/heresy-faq.ts) by question.
 *
 * About fifty rulings, so a plain word-overlap score is enough: each query
 * word found in a ruling's question (×2) or answer (×1) adds its inverse
 * document frequency, so "Vanguard" or "Reserves" counts for more than
 * "unit". Words are lower-cased and crudely singularised.
 */
import { HERESY_FAQ } from "../data/heresy-faq.js";
import type { HeresyFaqEntry } from "../types.js";
import { heresyStamp } from "./heresy-format.js";

const STOP = new Set(
  ("a an the of to in on for and or is are be does do can if it its this that with as at by from what when which who " +
    "how my i me you your their they them there any all each into than then so not no yes may must unit units model models " +
    "rule rules special heresy horus game player players").split(" "),
);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

const DOCS = HERESY_FAQ.map((e) => ({ e, q: new Set(words(e.question)), a: new Set(words(e.answer)) }));
const IDF = new Map<string, number>();
for (const d of DOCS) for (const w of new Set([...d.q, ...d.a])) IDF.set(w, (IDF.get(w) ?? 0) + 1);
for (const [w, n] of IDF) IDF.set(w, Math.log(1 + DOCS.length / n));

export function searchHeresyFaq(query: string, limit = 3): { entry: HeresyFaqEntry; score: number }[] {
  const qw = [...new Set(words(query))];
  if (!qw.length) return [];
  // A query word no ruling uses still counts against the match ("lascannon cost" must not match a ruling about Reaction costs).
  const unseen = Math.log(1 + DOCS.length);
  const maxScore = qw.reduce((a, w) => a + 2 * (IDF.get(w) ?? unseen), 0) || 1;
  return DOCS.map((d) => {
    let s = 0;
    for (const w of qw) {
      const idf = IDF.get(w) ?? 0;
      if (d.q.has(w)) s += 2 * idf;
      else if (d.a.has(w)) s += idf;
    }
    return { entry: d.e, score: s / maxScore };
  })
    .filter((r) => r.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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
