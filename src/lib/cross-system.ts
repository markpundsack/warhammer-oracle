/**
 * Cross-system fallback between Warhammer 40,000 and Horus Heresy.
 *
 * People rarely say which game they mean. With no game_mode, a lookup that
 * finds nothing good in 40K but a clear match in Horus Heresy answers from
 * Heresy (and the reverse for an explicit Heresy query), with the other
 * system's mode stamp and one line saying where it was found. A name that
 * exists in both stays with the requested (or default) system.
 *
 * Thresholds use `scoreName`'s tiers: 1 exact, 0.95 plural/singular,
 * 0.9/0.88 the query is the start of the name, 0.82 a whole-word run inside
 * the name, 0.6-0.75 all query words in any order, 0.55 bare substring,
 * below that a misspelling. Only exact, plural or name-prefix matches
 * (>= 0.88) count as "good", so a loose match in one system never beats an
 * exact name in the other, and a weak match in the other system never wins.
 */
import { scoreName } from "./search.js";

export const STRONG_MATCH = 0.88;

/** Should the lookup answer from the other system instead? */
export function shouldCrossOver(homeScore: number, otherScore: number): boolean {
  return homeScore < STRONG_MATCH && otherScore >= STRONG_MATCH;
}

/** "Leviathan Dreadnought [Legends]" → "Leviathan Dreadnought". */
export function stripCatalogueTag(name: string): string {
  return name.replace(/\s*\[[^\]]*\]\s*$/, "");
}

/** `scoreName`, also crediting a 40K name with its "[Legends]"/"[Crucible]" tag removed. */
export function scoreTaggedName(query: string, name: string): number {
  return Math.max(scoreName(query, name), scoreName(query, stripCatalogueTag(name)));
}

/** Put a one-line note straight after the response's mode stamp (or first, if there is no stamp). */
export function withCrossSystemNote(text: string, stamp: string, note: string): string {
  const line = `_${note}_`;
  return stamp && text.startsWith(stamp) ? `${stamp}\n\n${line}${text.slice(stamp.length)}` : `${line}\n\n${text}`;
}

/**
 * With an explicit game_mode, the other game's result is never substituted:
 * the requested game's answer (often "not found") gets this one line instead.
 */
export function otherGamePointer(other: "heresy" | "40k", name: string): string {
  return other === "heresy"
    ? `Not in Warhammer 40,000; Horus Heresy has "${name}" (game_mode "heresy").`
    : `Not in Horus Heresy; Warhammer 40,000 has "${name}" (game_mode "40k").`;
}
