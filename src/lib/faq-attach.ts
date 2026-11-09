/**
 * Official rulings that come along with a lookup's answer, so a single question gets the
 * rule and its clarifications together. Shared by Warhammer 40,000 and Horus Heresy: each
 * system registers its rulings; one matching and formatting policy for both.
 *
 * A ruling is attached only if it ranks well for a name the answer is about AND its question
 * or answer actually contains that name. Army-specific rulings need either that army or a
 * specific subject (a named unit or stratagem): a generic rule like "Stealth" must not pull in
 * a ruling about one faction's character. At most `limit` rulings, never the same one twice.
 */
export interface AttachableRuling {
  question: string;
  answer: string;
}

export interface FaqSystemSource<T extends AttachableRuling = AttachableRuling> {
  /** Best rulings for a query, best first. */
  search(query: string, limit: number): { entry: T; score: number }[];
  /** The army a ruling is limited to, or undefined for a core ruling. */
  army(entry: T): string | undefined;
  /** Does `army` (as a player or tool names it) mean this ruling's army? */
  sameArmy(entry: T, army: string): boolean;
  /** "**Q:** … **A:** … _source_". */
  format(entry: T): string;
}

export type FaqSystem = "40k" | "heresy";

const SOURCES: Partial<Record<FaqSystem, FaqSystemSource>> = {};

export function registerFaqSource<T extends AttachableRuling>(system: FaqSystem, source: FaqSystemSource<T>): void {
  SOURCES[system] = source as unknown as FaqSystemSource;
}

export const MIN_SCORE = 0.35;
export const HEADING = "## Official clarifications";

/** Lowercase, punctuation as spaces: "Force (X)" and "the Force (X) Special Rule" compare as "force x". */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
}

function stemOf(name: string): string {
  return normalizeForMatch(name).replace(/(ing|s)$/, "");
}

export function attachRulings(opts: {
  system: FaqSystem;
  names: (string | undefined)[];
  army?: string;
  /** The answer is about one named thing (a unit, a stratagem), so army rulings that name it may attach. */
  specific?: boolean;
  limit?: number;
}): string {
  const source = SOURCES[opts.system];
  if (!source) return "";
  const limit = opts.limit ?? 2;
  const picked: AttachableRuling[] = [];
  for (const name of opts.names) {
    if (!name || picked.length >= limit) continue;
    const stem = stemOf(name);
    if (stem.length < 4) continue;
    for (const { entry, score } of source.search(name, 6)) {
      if (picked.length >= limit) break;
      if (score < MIN_SCORE || picked.includes(entry)) continue;
      const armyOnly = source.army(entry);
      if (armyOnly && !(opts.specific || (opts.army && source.sameArmy(entry, opts.army)))) continue;
      if (!normalizeForMatch(`${entry.question} ${entry.answer}`).includes(stem)) continue;
      picked.push(entry);
    }
  }
  return picked.length ? `\n\n${HEADING}\n\n${picked.map((e) => source.format(e)).join("\n\n")}` : "";
}
