/**
 * Every Horus Heresy rule the Oracle can look up by name, in one list:
 * special rules and the profile-based rules (Reactions, Gambits, psychic
 * powers, wargear, assets, detachments) from BSData, plus the core rulebook
 * sections (turn sequence, statuses, core Reactions and Gambits, missions,
 * the Crusade Force Organisation Chart) from Wahapedia.
 *
 * Order matters on a tied score: a special rule beats a profile rule beats a
 * core rules section of the same name.
 */
import { HERESY_CORE_RULES } from "../data/heresy-core-rules.js";
import { HERESY_PROFILE_RULES } from "../data/heresy-profile-rules.js";
import { HERESY_SPECIAL_RULES } from "../data/heresy-rules.js";
import type { HeresySpecialRule } from "../types.js";

export const HERESY_RULE_CORPUS: HeresySpecialRule[] = [
  ...HERESY_SPECIAL_RULES,
  ...HERESY_PROFILE_RULES,
  ...HERESY_CORE_RULES,
];

/**
 * The named rules only (no core rules prose or missions). Used when no
 * game_mode was given: generic section titles like "Line of Sight" or
 * "Movement Phase" must not pull a 40K question over to Heresy.
 */
export const HERESY_NAMED_RULES: HeresySpecialRule[] = [...HERESY_SPECIAL_RULES, ...HERESY_PROFILE_RULES];
