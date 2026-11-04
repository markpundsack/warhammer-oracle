/**
 * Finding a Horus Heresy datasheet by name, shared by lookup_unit and
 * compare_units.
 *
 * Players often name a model rather than its unit ("Legionaries" — the
 * Tactical Squad's models; "a Legion Centurion"). When no unit name matches
 * well, a model name that does picks the unit fielding the most of that model.
 */
import { HERESY_UNITS } from "../data/heresy-units.js";
import { heresyContentKey } from "./heresy-format.js";
import { fuzzySearch, normalizeName, rankByName } from "./search.js";
import type { HeresyUnit } from "../types.js";

/** A unit-name score at or above this is trusted over a model-name match. */
const GOOD_UNIT_MATCH = 0.9;
/** How well a model name must match to stand in for a unit name. */
const MODEL_MATCH = 0.85;

export type HeresyUnitMatch =
  | {
      kind: "unit";
      unit: HeresyUnit;
      score: number;
      /** Same-name datasheets with different content (one per distinct content); length > 1 means "ask which". */
      variants: HeresyUnit[];
      /** Factions with an identical copy of `unit`. */
      alsoIn: string[];
    }
  | {
      kind: "model";
      unit: HeresyUnit;
      /** The model's name as written in the data, e.g. "Legionary". */
      model: string;
      score: number;
      /** Other units that field this model. */
      otherUnits: HeresyUnit[];
    };

function maxOfModel(unit: HeresyUnit, model: string): number {
  const n = normalizeName(model);
  return Math.max(0, ...(unit.composition ?? []).filter((c) => normalizeName(c.model) === n).map((c) => c.max));
}

export function findHeresyUnit(
  name: string,
  { faction, datasheetId, pool = HERESY_UNITS }: { faction?: string; datasheetId?: string; pool?: HeresyUnit[] } = {},
): HeresyUnitMatch | null {
  let candidates = [...pool];
  // A Legion name also finds the generic Legiones Astartes units it can field.
  if (faction) candidates = fuzzySearch(candidates, faction, ["faction", "availableIn"]);
  if (datasheetId) candidates = candidates.filter((u) => u.id === datasheetId);

  // Among equal name scores, the shortest name is the closest match
  // ("Contemptor" → "Contemptor Dreadnought", not "Contemptor-Incaendius Dreadnought").
  const ranked = rankByName(candidates, name, (u) => u.name, 0.3).sort(
    (a, b) => b.score - a.score || a.item.name.length - b.item.name.length,
  );
  const unitScore = ranked[0]?.score ?? 0;

  if (unitScore < GOOD_UNIT_MATCH && !datasheetId) {
    const byModel = candidates
      .flatMap((u) => u.models.map((m) => ({ u, model: m.name, score: rankByName([m.name], name, (x) => x)[0]?.score ?? 0 })))
      .filter((x) => x.score >= MODEL_MATCH && x.score > unitScore)
      .sort((a, b) => b.score - a.score || maxOfModel(b.u, b.model) - maxOfModel(a.u, a.model) || a.u.name.length - b.u.name.length);
    if (byModel.length) {
      const best = byModel[0];
      const seen = new Set([best.u.id]);
      const otherUnits: HeresyUnit[] = [];
      for (const x of byModel) {
        if (normalizeName(x.model) !== normalizeName(best.model) || seen.has(x.u.id)) continue;
        seen.add(x.u.id);
        otherUnits.push(x.u);
      }
      return { kind: "model", unit: best.u, model: best.model, score: best.score, otherUnits };
    }
  }

  if (ranked.length === 0) return null;
  const top = ranked[0].item;
  // Same-name datasheets: identical copies (e.g. each Legion's own "Inductii
  // Squad") collapse to one; genuinely different ones need a faction.
  const sameName = ranked.map((r) => r.item).filter((u) => normalizeName(u.name) === normalizeName(top.name));
  const contents = new Map<string, HeresyUnit[]>();
  for (const u of sameName) contents.set(heresyContentKey(u), [...(contents.get(heresyContentKey(u)) ?? []), u]);
  const variants = unitScore >= GOOD_UNIT_MATCH && contents.size > 1 ? [...contents.values()].map((g) => g[0]) : [top];
  const alsoIn = (contents.get(heresyContentKey(top)) ?? []).filter((u) => u !== top).map((u) => u.faction);
  return { kind: "unit", unit: top, score: unitScore, variants, alsoIn };
}

/** One line explaining a model-name match, for the top of a response. */
export function modelMatchNote(m: Extract<HeresyUnitMatch, { kind: "model" }>, asked: string): string {
  const others = m.otherUnits.slice(0, 5).map((u) => u.name);
  const more = m.otherUnits.length > 5 ? `, and ${m.otherUnits.length - 5} more` : "";
  return (
    `_"${asked}" is a model, not a unit: the ${m.model} in the ${m.unit.name} datasheet below.` +
    (others.length ? ` Also fielded by: ${others.join(", ")}${more}.` : "") +
    "_"
  );
}
