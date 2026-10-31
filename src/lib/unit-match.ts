import { normalizeName, rankByName, scoreName } from "./search.js";

type NamedFactioned = {
  name: string;
  faction: string;
  keywords: string[];
};

/**
 * Is this entry the "canonical" home of its datasheet — i.e. does the
 * catalogue it lives in match its own faction keyword?
 *
 * BSData imports a datasheet into every faction that can take it as an ally
 * (Genestealer Cults get "Leman Russ Battle Tank", every Space Marine chapter
 * gets "Knight Paladin"), producing several `Unit` objects that differ only by
 * `faction`. The imported copies keep the *original* army's faction keyword
 * ("Astra Militarum", "Imperial Knights"), so the copy whose `faction` is
 * exactly one of its own `keywords` is the real one.
 *
 * The match is exact, not a prefix: a broad keyword like "Chaos" must not be
 * allowed to vouch for both "Chaos Daemons" and "Chaos Space Marines" — that
 * is the very collision we are trying to break.
 */
export function isCanonicalFaction(entry: NamedFactioned): boolean {
  const faction = normalizeName(entry.faction);
  if (!faction) return false;
  return entry.keywords.some((kw) => normalizeName(kw) === faction);
}

/** Compare everything the lookup formatter can return, except catalogue identity. */
export function datasheetContentKey<T extends NamedFactioned>(entry: T): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(entry).filter(([field]) => !["id", "faction", "gameSystem"].includes(field)),
    ),
  );
}

function dedupeKey<T extends NamedFactioned>(entry: T, contentOf: (item: T) => string): string {
  return JSON.stringify([normalizeName(entry.name), normalizeName(entry.faction), contentOf(entry)]);
}

/**
 * Rank `units` for a `lookup_*`-style "which datasheet did they mean" query:
 * score by name and keep the best-scoring tier, then drop cross-faction
 * *imports* — a non-canonical entry whose content is already carried by a
 * canonical entry in that tier (Genestealer Cults' copy of the Astra Militarum
 * Leman Russ). A non-canonical entry with content no canonical entry has —
 * a genuinely parallel datasheet, e.g. the faster World Eaters Helbrute — is
 * kept. Exact-duplicate entries are collapsed; order is stable.
 *
 * `contentOf` maps an entry to comparable returned content; the default treats
 * every entry as identical, which collapses to "keep only the canonical
 * copies when any exist".
 */
export function rankUnitMatches<T extends NamedFactioned>(
  units: T[],
  query: string,
  contentOf: (item: T) => string = () => "",
  minScore = 0.3,
): T[] {
  const ranked = rankByName(units, query, (u) => u.name, minScore);
  if (ranked.length === 0) return [];

  const topScore = ranked[0].score;
  const top: T[] = [];
  const rest: T[] = [];
  for (const r of ranked) {
    (Math.abs(r.score - topScore) < 1e-9 ? top : rest).push(r.item);
  }

  const canonicalContents = new Set(top.filter(isCanonicalFaction).map(contentOf));
  const trimmedTop = top.filter(
    (e) => isCanonicalFaction(e) || !canonicalContents.has(contentOf(e)),
  );

  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of [...trimmedTop, ...rest]) {
    const key = dedupeKey(entry, contentOf);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Given the output of `rankUnitMatches`, is the leading result still a genuine
 * ambiguity — one datasheet name with different returned content, possibly
 * within the same faction? If so, `lookup_unit` should offer every selectable
 * variant rather than silently pick one. This
 * mirrors the disambiguation `lookup_stratagem` already does for name
 * collisions.
 *
 * Only a near-exact query is disambiguated — a loose/partial match resolving
 * to its best guess is expected behaviour. Same-name imports that share content
 * (the Chaos triad's shared datasheets, a unit fielded identically by
 * many Space Marine chapters) are not flagged: any copy gives the same answer.
 *
 * Returns one entry per faction and distinct content (stable order), or
 * `null` when there is nothing to disambiguate.
 */
export function ambiguousFactionMatches<T extends NamedFactioned>(
  matches: T[],
  query: string,
  contentOf: (item: T) => string,
): T[] | null {
  if (matches.length < 2) return null;
  if ((rankByName([matches[0]], query, (u) => u.name)[0]?.score ?? 0) < 0.9) return null;

  const topName = normalizeName(matches[0].name);
  const contents = new Set<string>();
  const options = new Map<string, T>();
  for (const m of matches) {
    if (normalizeName(m.name) !== topName) continue;
    const faction = normalizeName(m.faction);
    const content = contentOf(m);
    contents.add(content);
    const key = JSON.stringify([faction, content]);
    if (!options.has(key)) options.set(key, m);
  }
  if (contents.size < 2) return null;

  return [...options.values()];
}

/**
 * Catalogues whose own units carry a faction keyword that is not the
 * catalogue name. Keyed and valued by `normalizeName` form.
 *
 * Deliberately short: only add a catalogue whose keyword is unique to it.
 * "Heretic Astartes" is *not* here: Death Guard, Thousand Sons, World Eaters
 * and Emperor's Children units carry it too, so it cannot vouch for the Chaos
 * Space Marines catalogue.
 */
const HOME_CATALOGUE_KEYWORDS: Record<string, string> = {
  "chaos daemons": "legiones daemonica",
  "adeptus astartes space marines": "adeptus astartes",
};

const CHAPTER_CATALOGUE_PREFIX = "adeptus astartes ";

/**
 * How sure are we that this copy lives in its datasheet's home catalogue
 * rather than one that imports it? 2: the catalogue name is the unit's own
 * faction keyword (`isCanonicalFaction`) or, for a Space Marine chapter
 * catalogue ("Adeptus Astartes - Space Wolves"), its chapter keyword.
 * 1: the catalogue's known faction keyword differs from its name (Chaos
 * Daemons' units are LEGIONES DAEMONICA; generic Space Marine units are
 * ADEPTUS ASTARTES in "Adeptus Astartes - Space Marines", which every chapter
 * catalogue imports). 0: not identifiably home.
 */
export function homeFactionRank(entry: NamedFactioned): 0 | 1 | 2 {
  if (isCanonicalFaction(entry)) return 2;
  const faction = normalizeName(entry.faction);
  const keywords = entry.keywords.map(normalizeName);
  if (faction.startsWith(CHAPTER_CATALOGUE_PREFIX)) {
    const chapter = faction.slice(CHAPTER_CATALOGUE_PREFIX.length);
    if (chapter !== "space marines" && keywords.includes(chapter)) return 2;
  }
  const keyword = HOME_CATALOGUE_KEYWORDS[faction];
  if (keyword !== undefined && keywords.includes(keyword)) return 1;
  return 0;
}

export type HomeDatasheetResolution<T> = {
  /** The home copy of the shared datasheet: what to show. */
  pick: T;
  /** Other factions whose copy is identical to `pick`. */
  alsoFieldedBy: string[];
  /** Each remaining variant (one representative per distinct content) with the factions fielding it. */
  variants: { entry: T; factions: string[] }[];
};

/**
 * Given the variants `ambiguousFactionMatches` returned for a query with **no
 * faction filter**, is one of them clearly the datasheet a bare name means?
 *
 * BSData shares a datasheet across every catalogue that may field it (the
 * Bloodletters datasheet sits in eight Chaos catalogues; the Space Marine Land
 * Raider in all twelve chapter catalogues), and separately a few armies carry
 * their own same-named variant (World Eaters' summoned Blood Legions
 * Bloodletters, the Grey Knights Land Raider). Asking "which army?" there is
 * noise: the user means the shared datasheet, from its home catalogue.
 *
 * Resolves only when the answer is lopsided:
 * - the most widely fielded variant contains an identifiable home copy
 *   (`homeFactionRank` > 0), and
 * - it is fielded by at least twice as many factions as every other variant
 *   combined.
 *
 * So the Sorcerer (one Chaos Space Marines datasheet shared by three
 * catalogues, plus separate Thousand Sons and Emperor's Children datasheets)
 * stays a genuine ambiguity, as do the Chaos Rhino/Helbrute families where
 * each Legion has its own version and anything with no identifiable home.
 * Callers must not use this when the user supplied a faction: same-faction
 * variants (the two Death Guard Great Unclean Ones) are a real choice. The
 * caller is expected to surface `variants`, which may differ in stats,
 * weapons or points.
 */
export function resolveHomeDatasheet<T extends NamedFactioned>(
  variants: T[],
  contentOf: (item: T) => string,
): HomeDatasheetResolution<T> | null {
  const groups = new Map<string, T[]>();
  for (const v of variants) {
    const key = contentOf(v);
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  if (groups.size < 2) return null;

  const factionsOf = (g: T[]) => [...new Set(g.map((v) => v.faction))];
  const ordered = [...groups.values()];
  const best = ordered.reduce((a, b) => (factionsOf(b).length > factionsOf(a).length ? b : a));
  const others = ordered.filter((g) => g !== best);
  const otherCount = others.reduce((n, g) => n + factionsOf(g).length, 0);
  if (factionsOf(best).length < 2 * otherCount) return null;

  const pick = best.reduce((a, b) => (homeFactionRank(b) > homeFactionRank(a) ? b : a));
  if (homeFactionRank(pick) === 0) return null;

  return {
    pick,
    alsoFieldedBy: factionsOf(best).filter((f) => f !== pick.faction),
    variants: others.map((g) => ({ entry: g[0], factions: factionsOf(g) })),
  };
}

/**
 * Rank `units` for `query`, also trying a leading faction word as a filter:
 * "Ork Boyz" → "Boyz" within Orks, "Space Marine Intercessors" → "Intercessors"
 * within the Space Marine catalogues. People (and voice assistants) often say
 * the army before the unit; the plain ranking only gets those by luck (a loose
 * substring) or not at all. Whichever reading names its top match better wins;
 * ties go to the plain ranking, so a name that really starts with a faction
 * word ("Necron Warriors") is unaffected.
 */
export function rankUnitMatchesWithFactionHint<T extends NamedFactioned>(
  units: T[],
  query: string,
  contentOf: (item: T) => string = () => "",
): T[] {
  const best = (matches: T[], q: string) => (matches.length > 0 ? scoreName(q, matches[0].name) : 0);
  let out = rankUnitMatches(units, query, contentOf);
  let outScore = best(out, query);
  if (outScore >= 1) return out;

  const tokens = normalizeName(query).split(" ");
  const factions = [...new Set(units.map((u) => u.faction))];
  for (let i = 1; i < tokens.length; i++) {
    const prefix = tokens.slice(0, i).join(" ");
    const rest = tokens.slice(i).join(" ");
    const hinted = factions.filter((f) => scoreName(prefix, f) >= 0.6);
    if (hinted.length === 0) continue;
    const matches = rankUnitMatches(units.filter((u) => hinted.includes(u.faction)), rest, contentOf);
    const score = best(matches, rest);
    if (score > outScore) {
      out = matches;
      outScore = score;
    }
  }
  return out;
}

/**
 * The single datasheet a non-interactive caller (compare_units) should use for
 * `query`, given `rankUnitMatches` output: the home-army copy when
 * `resolveHomeDatasheet` settles a cross-faction ambiguity, otherwise the
 * top match, preferring an identical copy from its home catalogue so the
 * faction shown is the unit's own rather than data-file order's first
 * (Black Templars, alphabetically).
 */
export function pickUnitMatch<T extends NamedFactioned>(
  matches: T[],
  query: string,
  contentOf: (item: T) => string,
): T | undefined {
  if (matches.length === 0) return undefined;
  const ambiguous = ambiguousFactionMatches(matches, query, contentOf);
  const home = ambiguous ? resolveHomeDatasheet(ambiguous, contentOf) : null;
  if (home) return home.pick;
  const top = matches[0];
  const same = matches.filter(
    (m) => normalizeName(m.name) === normalizeName(top.name) && contentOf(m) === contentOf(top),
  );
  return same.reduce((a, b) => (homeFactionRank(b) > homeFactionRank(a) ? b : a), top);
}
