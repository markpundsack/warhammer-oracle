/**
 * The Horus Heresy 3rd Edition turn sequence for lookup_phase, built from the
 * core rules sections (src/data/heresy-core-rules.ts) rather than written by
 * hand: each phase's steps are its sub-phases with their one-line summaries,
 * and its tips name the Core Reaction the Reactive Player may use in it.
 */
import { HERESY_CORE_RULES } from "./heresy-core-rules.js";
import type { HeresySpecialRule, Phase } from "../types.js";

const PHASE_NAMES = ["Start", "Movement", "Shooting", "Assault", "End"] as const;

function firstSentence(r: HeresySpecialRule): string {
  if (r.summary) return r.summary;
  const plain = r.description.replace(/\*\*/g, "").split("\n").find((l) => l.trim() && !l.startsWith("-")) ?? "";
  return plain.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? plain.trim();
}

function buildPhase(name: (typeof PHASE_NAMES)[number], order: number): Phase {
  const phaseTitle = `The ${name} Phase`;
  const phase = HERESY_CORE_RULES.find((r) => r.name === phaseTitle && r.kind === "core rule");
  const subPhases = HERESY_CORE_RULES.filter(
    (r) => /Sub-Phase$/.test(r.name) && (r.context ?? "").endsWith(`> ${phaseTitle}`),
  );
  const steps = subPhases.map((s) => `${s.name.replace(/^The /, "")}: ${firstSentence(s)}`);
  const tips: string[] = [];
  if (phase) tips.push(firstSentence(phase));
  const coreReaction = HERESY_CORE_RULES.find((r) => r.kind === "reaction" && r.name.startsWith(`${name} Phase:`));
  if (coreReaction) {
    tips.push(`Core Reaction for the Reactive Player: ${coreReaction.name.split(":")[1].trim()} — ${firstSentence(coreReaction)}`);
  }
  return { name, order, steps, tips, gameMode: "heresy" };
}

export const PHASES_HERESY: Phase[] = PHASE_NAMES.map((n, i) => buildPhase(n, i + 1));
