/**
 * Every Horus Heresy rule the Oracle can look up by name, in one list:
 * special rules and the profile-based rules (Reactions, Gambits, psychic
 * powers, wargear, assets, detachments) from BSData, plus the core rulebook
 * sections (turn sequence, statuses, core Reactions and Gambits, missions,
 * the Crusade Force Organisation Chart) and each army list's rules (Rites of
 * War, Legion Advanced Reactions, detachments, armouries) from Wahapedia.
 *
 * Order matters on a tied score: a special rule beats a profile rule beats a
 * core rules section beats one army list's copy of the same name ("Deploy
 * Objectives" in the core missions, not in the Titan missions).
 */
import { HERESY_ARMY_RULES } from "../data/heresy-army-rules.js";
import { HERESY_CORE_RULES } from "../data/heresy-core-rules.js";
import { HERESY_PROFILE_RULES } from "../data/heresy-profile-rules.js";
import { HERESY_CURATED_RULES } from "../data/heresy-curated-rules.js";
import { HERESY_SPECIAL_RULES } from "../data/heresy-rules.js";
import type { HeresySpecialRule } from "../types.js";

export const HERESY_RULE_CORPUS: HeresySpecialRule[] = [
  ...HERESY_CURATED_RULES,
  ...HERESY_SPECIAL_RULES,
  ...HERESY_PROFILE_RULES,
  ...HERESY_CORE_RULES,
  ...HERESY_ARMY_RULES,
];

/** Rulebook entries with a distinctive game-term name, as opposed to section prose ("Line of Sight", "Measuring"). */
const NAMED_KINDS = new Set(["reaction", "gambit", "status", "rite of war", "cybertheurgic rite"]);

/**
 * The named rules only (no core rules prose or missions). Used when no
 * game_mode was given: generic section titles like "Line of Sight" or
 * "Movement Phase" must not pull a 40K question over to Heresy, but "Return
 * Fire", "Flurry of Blows" or "Pinned" (Heresy-only terms) should.
 */
export const HERESY_NAMED_RULES: HeresySpecialRule[] = [
  ...HERESY_SPECIAL_RULES,
  ...HERESY_PROFILE_RULES,
  ...[...HERESY_ARMY_RULES, ...HERESY_CORE_RULES].filter((r) => NAMED_KINDS.has(r.kind ?? "")),
];

/**
 * When no rule is *named* like the query ("snap shots", "primarch"), the rule
 * whose text uses the phrase most — whole words, core rules first on a tie,
 * shorter sections first after that.
 */
export function findHeresyRuleMentioning(query: string, corpus: HeresySpecialRule[] = HERESY_RULE_CORPUS): HeresySpecialRule | undefined {
  const words = query.toLowerCase().replace(/[^a-z0-9' -]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.join("").length < 4) return undefined;
  const stem = words.map((w) => w.replace(/s$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b${stem.join("s?[ -]")}s?\\b`, "gi");
  const rank = (r: HeresySpecialRule) => (r.kind === "core rule" || r.kind === "status" ? 0 : 1);
  let best: { r: HeresySpecialRule; hits: number } | undefined;
  for (const r of corpus) {
    const hits = (r.description.match(re) ?? []).length;
    if (!hits) continue;
    if (
      !best ||
      hits > best.hits ||
      (hits === best.hits && (rank(r) < rank(best.r) || (rank(r) === rank(best.r) && r.description.length < best.r.description.length)))
    ) {
      best = { r, hits };
    }
  }
  return best?.r;
}
