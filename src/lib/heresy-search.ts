/**
 * Ranked search over Horus Heresy rules by what a player says, not just by rule names.
 *
 * Players (and the voice model) ask with their own words: "volley fire" for "4. Make Volley
 * Attacks", "snapshot" for Snap Shots, "glancing hits", "ramming". A name-only fuzzy match misses
 * these or, worse, picks a rule whose name merely shares letters. Instead every rule is scored
 * BM25-style over its name and aliases (weighted most), its summary, and its full text, so a
 * distinctive word ("volley") finds the rule that's about it and common words ("the", "can",
 * "weapon") count for little. A precise name match still wins outright.
 */
import type { HeresySpecialRule } from "../types.js";
import { HERESY_SPOKEN_NAMES } from "../data/heresy-curated-rules.js";
import { scoreHeresyRule } from "./heresy-format.js";

const STOP = new Set(
  ("a an the of to in on at for with and or is are be can do does did how what when which who why if it its it's my your " +
    "their this that these those as by from into vs versus i we you they them me use using used rule rules work works " +
    "happen happens get gets make made makes about any all some one per there".split(" ")),
);

/** Same word, different ending: plurals, -ing, -ed ("charging" → "charg", "charges" → "charg"). */
export function stem(w: string): string {
  let t = w.toLowerCase().replace(/['’]s$/, "");
  if (t.length > 5 && t.endsWith("ies")) t = `${t.slice(0, -3)}y`;
  else if (t.length > 4 && /(ses|xes|ches|shes)$/.test(t)) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
  if (t.length > 3 && t.endsWith("e")) t = t.slice(0, -1); // "charge" and "charg(ing)" meet
  if (t.length > 3 && /(.)\1$/.test(t)) t = t.slice(0, -1); // "ramm(ing)" → "ram"
  return t;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9']+/g, " ").split(" ").filter(Boolean);
}

/** Words a player might say for another term in the rules ("to hit" → "hit test"). Kept small and literal. */
const SAYS: Record<string, string[]> = {
  snapshot: ["snap", "shot"],
  snapfire: ["snap", "shot"],
  tohit: ["hit", "test"],
  towound: ["wound", "test"],
  ram: ["ram"],
  tankshock: ["ram"],
  pen: ["penetrat"],
  glance: ["glanc"],
  invuln: ["invulnerabl", "save"],
  invul: ["invulnerabl", "save"],
  los: ["line", "sight"],
  hp: ["hull", "point"],
  vp: ["victory", "point"],
  ap: ["ap"],
  fnp: ["damag", "mitigation"],
};

type Doc = { rule: HeresySpecialRule; name: Map<string, number>; summary: Map<string, number>; body: Map<string, number>; bodyLen: number };

function counts(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export type HeresySearch = (query: string, limit?: number) => { rule: HeresySpecialRule; score: number }[];

export function buildHeresySearch(corpus: HeresySpecialRule[]): HeresySearch {
  const docs: Doc[] = corpus.map((rule) => {
    const nameText = [rule.name.replace(/^\d+\.\s*/, ""), ...rule.aliases, ...(HERESY_SPOKEN_NAMES[rule.name] ?? [])].join(" ");
    const body = words(rule.description).filter((w) => !STOP.has(w)).map(stem);
    return {
      rule,
      name: counts(words(nameText).filter((w) => !STOP.has(w)).map(stem)),
      summary: counts(words(rule.summary ?? "").filter((w) => !STOP.has(w)).map(stem)),
      body: counts(body),
      bodyLen: body.length,
    };
  });
  // A player's exact phrase for a section ("advance" → Rush) beats any partial match
  const spokenExact = new Map<string, HeresySpecialRule[]>();
  for (const d of docs) {
    for (const p of HERESY_SPOKEN_NAMES[d.rule.name] ?? []) {
      const k = words(p).join(" ");
      spokenExact.set(k, [...(spokenExact.get(k) ?? []), d.rule]);
    }
  }
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set([...d.name.keys(), ...d.summary.keys(), ...d.body.keys()])) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const avgLen = docs.reduce((a, d) => a + d.bodyLen, 0) / Math.max(1, N);
  const idf = (t: string) => Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
  const vocab = (t: string) => df.has(t);

  const byDf = [...df.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
  /** The most common rule word within one edit (or two, for long words) of `w`. */
  function nearest(w: string): string | undefined {
    const max = w.length >= 7 ? 2 : 1;
    return byDf.find((t) => Math.abs(t.length - w.length) <= max && t[0] === w[0] && editDistance(t, w, max) <= max);
  }

  /** Query → stemmed terms, with run-together words split ("snapshot" → snap, shot) and player shorthand expanded. */
  function terms(query: string): string[] {
    const raw = words(query).filter((w) => !STOP.has(w));
    const joined = raw.join("");
    if (SAYS[joined]) return SAYS[joined];
    const out: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const pair = raw[i] + (raw[i + 1] ?? "");
      if (raw[i + 1] && SAYS[pair]) {
        out.push(...SAYS[pair]);
        i++;
        continue;
      }
      if (SAYS[raw[i]]) {
        out.push(...SAYS[raw[i]]);
        continue;
      }
      const s = stem(raw[i]);
      // Two words heard apart that the rules write as one ("over watch", "out flank", "set up")
      const together = raw[i + 1] ? stem(raw[i] + raw[i + 1]) : "";
      if (together && vocab(together) && !(vocab(s) && vocab(stem(raw[i + 1])) && (df.get(together) ?? 0) < 2)) {
        out.push(together);
        i++;
        continue;
      }
      if (vocab(s)) {
        out.push(s);
        continue;
      }
      // A mishearing one letter off a rule word ("volly", "ordinance", "flier")
      const near = s.length >= 4 ? nearest(s) : undefined;
      if (near) {
        out.push(near);
        continue;
      }
      if (raw[i].length < 7) {
        out.push(s);
        continue;
      }
      // A run-together word: split where both halves are rule words
      let split: string[] | undefined;
      for (let k = 3; k <= raw[i].length - 3 && !split; k++) {
        const a = stem(raw[i].slice(0, k)), b = stem(raw[i].slice(k));
        if (vocab(a) && vocab(b)) split = [a, b];
      }
      out.push(...(split ?? [s]));
    }
    return [...new Set(out)];
  }

  return (query: string, limit = 8) => {
    const q = terms(query);
    if (!q.length) return [];
    const maxPossible = q.reduce((a, t) => a + idf(t), 0) * 4;
    const K1 = 1.2, B = 0.35; // a long core rules section isn't penalised much for being long
    const scored = docs.map((d) => {
      let s = 0, matched = 0;
      for (const t of q) {
        const w = idf(t);
        const inName = d.name.has(t) ? 4 : 0;
        const inSummary = d.summary.has(t) ? 1.5 : 0;
        const tf = d.body.get(t) ?? 0;
        const inBody = tf ? (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.bodyLen) / avgLen)) : 0;
        if (inName || inSummary || tf) matched++;
        s += w * Math.max(inName, inSummary + inBody * 0.6, inBody * 0.6 + inName);
      }
      // Every word of the question present beats a pile of one word
      const coverage = matched / q.length;
      // The rulebook explains general terms; one army's wargear that mentions them comes after.
      const kind = d.rule.kind ?? "special rule";
      const general = kind === "core rule" || kind === "status" || kind === "reaction" ? 1.35 : kind === "army rule" ? 0.85 : 1;
      const text = (s / maxPossible) * coverage * coverage * general;
      const name = Math.max(scoreHeresyRule(d.rule, query), spokenExact.get(words(query).join(" "))?.includes(d.rule) ? 0.95 : 0);
      // A precise name still wins; a near-miss name only nudges.
      const score = name >= 0.88 ? 1 + name : Math.max(text, name >= 0.6 ? name * 0.7 : 0) + (name >= 0.6 ? 0.1 * name : 0);
      return { rule: d.rule, score };
    });
    return scored.filter((r) => r.score > 0.05).sort((a, b) => b.score - a.score).slice(0, limit);
  };
}

/** Levenshtein distance, giving up past `max`. */
function editDistance(a: string, b: string, max: number): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
