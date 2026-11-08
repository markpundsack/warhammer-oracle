/**
 * Hand-curated 11th Edition codex corrections, layered over the generated
 * BSData files (units-11e.ts, detachments-11e.ts, enhancements-11e.ts) by
 * current-11e.ts. Kept separate so `npm run fetch-data` can regenerate those
 * files without losing anything here.
 *
 * Source: the 11e codex faction pages Mark saved from Wahapedia on 8 Nov 2026
 * (Orks, Space Marines without Chapter supplements, Adeptus Custodes). Those
 * pages reproduce paid codex text, so every rule below is written in our own
 * words. Names, points, CP, dice and weapon numbers are recorded as facts.
 *
 * Only what differs from BSData, or is missing from it, belongs here.
 */
import type { Detachment, Enhancement } from "../types.js";

/** Replaces the matching BSData detachment's fields, or adds a detachment BSData lacks. */
export type DetachmentOverride = Pick<Detachment, "faction" | "name" | "ability"> &
  Partial<Pick<Detachment, "detachmentPoints" | "dispositions" | "restrictionTags">>;

/** Replaces the matching BSData enhancement, or adds one BSData lacks. */
export type EnhancementOverride = Pick<Enhancement, "faction" | "detachment" | "name" | "points" | "description">;

/** Replaces the text of an army-rule ability on every unit of a faction. */
export type UnitAbilityOverride = { faction: string; name: string; description: string };

export const DETACHMENT_OVERRIDES_11E: DetachmentOverride[] = [];

export const ENHANCEMENT_OVERRIDES_11E: EnhancementOverride[] = [];

export const UNIT_ABILITY_OVERRIDES_11E: UnitAbilityOverride[] = [];
