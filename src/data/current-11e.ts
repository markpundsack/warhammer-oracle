/**
 * The 11th Edition unit, detachment and enhancement data the tools serve:
 * generated BSData files with the hand-curated codex corrections from
 * codex-11e.ts applied. Import from here, not from the generated files.
 */
import type { Detachment, Enhancement, Unit } from "../types.js";
import { UNITS_11E as GENERATED_UNITS_11E } from "./units-11e.js";
import { DETACHMENTS_11E as GENERATED_DETACHMENTS_11E } from "./detachments-11e.js";
import { ENHANCEMENTS_11E as GENERATED_ENHANCEMENTS_11E } from "./enhancements-11e.js";
import {
  DETACHMENT_OVERRIDES_11E,
  ENHANCEMENT_OVERRIDES_11E,
  UNIT_ABILITY_OVERRIDES_11E,
  type DetachmentOverride,
  type EnhancementOverride,
  type UnitAbilityOverride,
} from "./codex-11e.js";

/** Lower-cased letters and digits only, so "Shadow Keepers" matches "Shadowkeepers" and ’ matches '. */
function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function codexId(...parts: string[]): string {
  return `codex-11e:${parts.map(key).join(":")}`;
}

export function applyDetachmentOverrides(base: Detachment[], overrides: DetachmentOverride[]): Detachment[] {
  const out = [...base];
  for (const o of overrides) {
    const i = out.findIndex((d) => d.faction === o.faction && key(d.name) === key(o.name));
    if (i >= 0) {
      out[i] = { ...out[i], ...o };
    } else {
      out.push({
        id: codexId(o.faction, o.name),
        detachmentPoints: null,
        dispositions: [],
        restrictionTags: [],
        gameSystem: "wh40k-11e",
        ...o,
      });
    }
  }
  return out;
}

export function applyEnhancementOverrides(base: Enhancement[], overrides: EnhancementOverride[]): Enhancement[] {
  const out = [...base];
  for (const o of overrides) {
    const i = out.findIndex(
      (e) => e.faction === o.faction && key(e.name) === key(o.name) && key(e.detachment) === key(o.detachment),
    );
    if (i >= 0) {
      out[i] = { ...out[i], ...o };
    } else {
      out.push({ id: codexId(o.faction, o.detachment, o.name), gameSystem: "wh40k-11e", ...o });
    }
  }
  return out;
}

export function applyUnitAbilityOverrides(base: Unit[], overrides: UnitAbilityOverride[]): Unit[] {
  if (overrides.length === 0) return base;
  return base.map((u) => {
    const mine = overrides.filter((o) => o.faction === u.faction);
    if (mine.length === 0) return u;
    let changed = false;
    const abilities = u.abilities.map((a) => {
      const o = mine.find((m) => m.name === a.name);
      if (!o) return a;
      changed = true;
      return { ...a, description: o.description };
    });
    return changed ? { ...u, abilities } : u;
  });
}

export const UNITS_11E: Unit[] = applyUnitAbilityOverrides(GENERATED_UNITS_11E, UNIT_ABILITY_OVERRIDES_11E);
export const DETACHMENTS_11E: Detachment[] = applyDetachmentOverrides(GENERATED_DETACHMENTS_11E, DETACHMENT_OVERRIDES_11E);
export const ENHANCEMENTS_11E: Enhancement[] = applyEnhancementOverrides(GENERATED_ENHANCEMENTS_11E, ENHANCEMENT_OVERRIDES_11E);
