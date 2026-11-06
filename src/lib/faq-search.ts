/**
 * Word-overlap search over a small set of FAQ rulings, shared by the Horus Heresy
 * and 40K FAQs.
 *
 * A plain score is enough at this size: each query word found in a ruling's
 * question (×2) or answer (×1) adds its inverse document frequency, so "Vanguard"
 * or "Reserves" counts for more than "unit". Words are lower-cased and crudely
 * singularised.
 */
const BASE_STOP = "a an the of to in on for and or is are be does do can if it its this that with as at by from what when which who how my i me you your their they them there any all each into than then so not no yes may must unit units model models rule rules special game player players";

export interface FaqEntryText {
  question: string;
  answer: string;
}

export function buildFaqSearch<T extends FaqEntryText>(entries: T[], extraStop = "") {
  const stop = new Set(`${BASE_STOP} ${extraStop}`.split(" "));
  const words = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[’']/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1 && !stop.has(w))
      .map((w) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));

  const docs = entries.map((e) => ({ e, q: new Set(words(e.question)), a: new Set(words(e.answer)) }));
  const idf = new Map<string, number>();
  for (const d of docs) for (const w of new Set([...d.q, ...d.a])) idf.set(w, (idf.get(w) ?? 0) + 1);
  for (const [w, n] of idf) idf.set(w, Math.log(1 + docs.length / n));

  return (query: string, limit = 3, keep: (e: T) => boolean = () => true): { entry: T; score: number }[] => {
    const qw = [...new Set(words(query))];
    if (!qw.length) return [];
    // A query word no ruling uses still counts against the match ("lascannon cost" must not match a ruling about Reaction costs).
    const unseen = Math.log(1 + docs.length);
    const maxScore = qw.reduce((a, w) => a + 2 * (idf.get(w) ?? unseen), 0) || 1;
    return docs
      .filter((d) => keep(d.e))
      .map((d) => {
        let s = 0;
        for (const w of qw) {
          const v = idf.get(w) ?? 0;
          if (d.q.has(w)) s += 2 * v;
          else if (d.a.has(w)) s += v;
        }
        return { entry: d.e, score: s / maxScore };
      })
      .filter((r) => r.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  };
}
