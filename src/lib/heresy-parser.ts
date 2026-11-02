/**
 * Parser for BSData/horus-heresy-3rd-edition (Horus Heresy 3rd Edition).
 *
 * The HH3 repo ships BattleScribe catalogues as JSON (the same New
 * Recruit-style encoding as wh40k-11e), but its profile types, stat columns,
 * points model and catalogue layout are all different from 40K's, so it gets
 * its own parser — the same way Kill Team has its own extractors — rather
 * than parameterising xml-parser.ts. It reads the raw JSON directly (HH3 has
 * no XML files, so the 10e XML-shape normalisation buys nothing here) and
 * never touches the 40K/Kill Team code paths.
 *
 * Everything here is data-driven: stat values, rule names and rule text are
 * the data's own strings. Where the data is conditional on roster choices
 * (a Rite of War, a Legion, an upgrade), this parser does not guess — see
 * `isHidden` and `HeresyUnit.conditionalRules`.
 */
import type {
  HeresyArmouredProfile,
  HeresyCompositionEntry,
  HeresyFaction,
  HeresyMeleeWeapon,
  HeresyModelProfile,
  HeresyModelWargear,
  HeresyPoints,
  HeresyRangedWeapon,
  HeresyRuleKind,
  HeresySpecialRule,
  HeresyUnit,
  HeresyWeapon,
  UnitSize,
} from "../types.js";

// === Profile/cost type IDs from "Horus Heresy 3rd Edition.json" (profileTypes/costTypes) ===
export const HH_MODEL_PROFILE_TYPE_ID = "a76f-8e23-8c3e-166d"; // "Profile"
export const HH_RANGED_WEAPON_TYPE_ID = "c591-09ed-3e6f-eb2b"; // "Ranged Weapon"
export const HH_MELEE_WEAPON_TYPE_ID = "3587-6dcd-005c-c263"; // "Melee Weapon"
const HH_REACTION_TYPE_ID = "c14c-ecfd-ea65-58c9"; // "Reaction"
const HH_WARGEAR_TYPE_ID = "5ec5-e0c3-1701-6f16"; // "Wargear" (Summary|Description)
const HH_TRAITS_TYPE_ID = "d5a9-9164-1e30-7a35"; // "Traits"
const HH_POINTS_COST_TYPE_ID = "9893-c379-920b-8982"; // "Point(s)"

/** Profile types with armour facings / HP instead of a model stat line. Matched by typeName. */
const ARMOURED_PROFILE_TYPE_NAMES = new Set([
  "Vehicle",
  "Knight",
  "Titan Head",
  "Titan Carapace",
  "Titan Legs",
  "Titan Arms",
  "Ordinatus Carriage",
  "Ordinatus Gun",
  "Battlefield fortification",
]);

/**
 * entryLinks / groups whose name matches point at roster-level option pools
 * rather than a unit's own wargear: Prime Benefits, Oaths of Moment, Rites
 * of War, the Thousand Sons' Prosperine Arcana and other Legion-specific
 * pools, the Shattered Legions' armoury, Weapons of Desperation (reclaimed
 * autoguns and the like), the Warlord flag. Following them pulls in dozens of
 * unrelated weapons and rules (the HH counterpart of fetch-data.ts's
 * UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN, tuned against HH3 output).
 */
export const HERESY_OPTION_POOL_NAME_PATTERN =
  /^prime (unit|benefits)|oath\(s\) of moment|mutable tactics|arcana|rite of war|^warlord( traits?)?$|legion specific upgrade|shattered legion armoury|weapons of desperation|psychic discipline|gambit/i;

const MAX_DEPTH = 12;

type Node = Record<string, any>;

export type HeresySourceFile = { path: string; data: any };

type Catalogue = {
  id: string;
  rawName: string;
  name: string;
  legion: string | null;
  library: boolean;
  gameSystem: boolean;
  node: Node;
  /** Catalogues linked with importRootEntries: their root entries are part of this army's roster. */
  imports: string[];
};

export type HeresyIndex = {
  catalogues: Map<string, Catalogue>;
  entries: Map<string, Node>;
  /** Catalogue id each entry/group is defined in. */
  entryHome: Map<string, string>;
  rules: Map<string, { rule: Node; home: string }>;
  profiles: Map<string, Node>;
};

export type HeresyParseResult = {
  units: HeresyUnit[];
  weapons: HeresyWeapon[];
  rules: HeresySpecialRule[];
  /** Reactions, Gambits, psychic powers, wargear, assets and detachments (profile-based rules). */
  profileRules: HeresySpecialRule[];
  factions: HeresyFaction[];
};

// === Small helpers ===

function arr<T = Node>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Collapse internal whitespace/newlines ("Sword of\nthe Order") and trim. */
function clean(v: unknown): string {
  return str(v).replace(/\s+/g, " ").trim();
}

/**
 * "                        XIII - Ultramarines" → { name: "Ultramarines", legion: "XIII" }.
 * HH3 catalogue names carry leading padding (a sort-order trick) and the
 * Legion's Roman numeral.
 */
export function cleanCatalogueName(raw: string): { name: string; legion: string | null } {
  const trimmed = clean(raw);
  const m = trimmed.match(/^([IVXL]+)\s*-\s*(.+)$/);
  if (m) return { name: m[2].trim(), legion: m[1] };
  return { name: trimmed, legion: null };
}

function characteristic(profile: Node, name: string): string {
  const c = arr(profile.characteristics).find((ch: Node) => str(ch.name).toLowerCase() === name.toLowerCase());
  return c ? clean(c.$text) : "";
}

/**
 * Split a comma-separated rules/traits cell at top-level commas only:
 * "Shock (Pinning, Stunned, Suppressed), Breaching (6+)" has two rules.
 * "-", "None" and empty cells are no rules.
 */
export function splitList(raw: string): string[] {
  const text = clean(raw);
  if (!text || /^(-|none)$/i.test(text)) return [];
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out.filter((x) => !/^(-|none)$/i.test(x));
}

// === Conditional visibility ===
//
// Same idea as the visibility evaluation in PR #13 (wargear/composition),
// adapted for HH3: BSData hides and shows content with modifiers like "set
// hidden=false if the primary catalogue is Blackshields" or "...if a Rite of
// War is in the roster". Only conditions answerable without a roster
// (instanceOf against the primary catalogue or an enclosing entry) are
// evaluated; everything else is unknown. Unlike #13, an unknown condition
// never changes the base `hidden` flag: in HH3, base-hidden content is
// overwhelmingly the context-specific kind (Legion-only weapons, Rite of War
// rules), so the conservative reading is the data's default state.

type Env = {
  /** The catalogue the unit is fielded from; undefined when it could be several (a library unit). */
  primaryCatalogueId?: string;
  /** Ids/category ids of enclosing selections, outermost first. */
  ancestors: Set<string>[];
};

type Tri = boolean | null;

function andTri(values: Tri[]): Tri {
  if (values.some((v) => v === false)) return false;
  if (values.some((v) => v === null)) return null;
  return true;
}

function orTri(values: Tri[]): Tri {
  if (values.some((v) => v === true)) return true;
  if (values.some((v) => v === null)) return null;
  return false;
}

function evalCondition(c: Node, env: Env): Tri {
  if (c.type !== "instanceOf" && c.type !== "notInstanceOf") return null;
  const childId = str(c.childId);
  if (!childId) return null;
  let hit: boolean;
  switch (c.scope) {
    case "primary-catalogue":
      if (!env.primaryCatalogueId) return null;
      hit = childId === env.primaryCatalogueId;
      break;
    case "ancestor":
      if (env.ancestors.length === 0) return null;
      hit = env.ancestors.some((a) => a.has(childId));
      break;
    case "parent":
      if (env.ancestors.length === 0) return null;
      hit = env.ancestors[env.ancestors.length - 1].has(childId);
      break;
    default:
      return null;
  }
  return c.type === "instanceOf" ? hit : !hit;
}

function evalConditions(holder: Node, env: Env, combine: "and" | "or" = "and"): Tri {
  const values: Tri[] = [
    ...arr(holder.conditions).map((c) => evalCondition(c, env)),
    ...arr(holder.conditionGroups).map((g) => evalConditions(g, env, g.type === "or" ? "or" : "and")),
  ];
  if (values.length === 0) return true;
  return combine === "or" ? orTri(values) : andTri(values);
}

/** Every modifier on a node with whether its enclosing modifierGroups apply. */
function modifiersOf(node: Node, env: Env): { m: Node; applies: Tri }[] {
  const out: { m: Node; applies: Tri }[] = [];
  const visit = (holder: Node, groupApplies: Tri): void => {
    for (const m of arr(holder.modifiers)) out.push({ m, applies: andTri([groupApplies, evalConditions(m, env)]) });
    for (const g of arr(holder.modifierGroups)) {
      visit(g, andTri([groupApplies, evalConditions(g, env, g.type === "or" ? "or" : "and")]));
    }
  };
  visit(node, true);
  return out;
}

/** Hidden in this context? Base flag, then modifiers whose conditions are decidably true. */
function isHidden(nodes: Node[], env: Env): boolean {
  let hidden = nodes.some((n) => n?.hidden === true || n?.hidden === "true");
  for (const n of nodes) {
    if (!n) continue;
    for (const { m, applies } of modifiersOf(n, env)) {
      if (m.field !== "hidden" || m.type !== "set") continue;
      if (applies === true) hidden = m.value === true || m.value === "true";
    }
  }
  return hidden;
}

/** Base-hidden, but some modifier might un-hide it depending on roster choices. */
function isConditionallyShown(nodes: Node[], env: Env): boolean {
  if (!isHidden(nodes, env)) return false;
  return nodes.some((n) =>
    modifiersOf(n ?? {}, env).some(
      ({ m, applies }) => m.field === "hidden" && m.type === "set" && (m.value === false || m.value === "false") && applies === null,
    ),
  );
}

/**
 * Apply `name` modifiers (set / replace / append / prepend) that certainly
 * apply. This is how HH3 gives a generic rule its value: the "Bulky (X)" rule
 * is linked with `{field:"name", type:"set", value:"Bulky (6)"}` or
 * `{field:"name", type:"replace", arg:"X", value:6}`.
 */
export function applyNameModifiers(
  baseName: string,
  nodes: Node[],
  env: Env,
): { name: string; uncertain: boolean; alternatives: string[] } {
  let name = baseName;
  let uncertain = false;
  const alternatives: string[] = [];
  const apply = (current: string, m: Node): string => {
    const value = str(m.value);
    if (m.type === "set") return value;
    if (m.type === "replace" && m.arg != null) {
      const arg = str(m.arg);
      // "replace x" on "Infiltrate (X)": a single-letter placeholder is matched case-insensitively.
      const pattern = new RegExp(arg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), arg.length === 1 ? "gi" : "g");
      return current.replace(pattern, value);
    }
    if (m.type === "append") return `${current} ${value}`;
    if (m.type === "prepend") return `${value} ${current}`;
    return current;
  };
  for (const n of nodes) {
    for (const { m, applies } of modifiersOf(n ?? {}, env)) {
      if (m.field !== "name") continue;
      if (applies === null) {
        uncertain = true;
        alternatives.push(clean(apply(name, m)));
        continue;
      }
      if (applies === false) continue;
      name = apply(name, m);
    }
  }
  return { name: clean(name), uncertain, alternatives: [...new Set(alternatives)] };
}

/**
 * "Bulky (X)" with roster-dependent alternatives "Bulky (2)" / "Bulky (3)" →
 * "Bulky (2 or 3, depending on options)". Falls back to flagging the X.
 */
function describeUncertainName(name: string, alternatives: string[]): string {
  const base = name.replace(/\s*\([^)]*\)\s*$/, "");
  const values = alternatives.map((a) => a.match(/^(.*?)\s*\(([^)]*)\)\s*$/)).filter((m): m is RegExpMatchArray => !!m);
  if (values.length === alternatives.length && values.length > 0 && values.every((m) => m[1] === base)) {
    return `${base} (${values.map((m) => m[2]).join(" or ")}, depending on options)`;
  }
  return `${name} [X depends on army options]`;
}

// === Index ===

export function buildHeresyIndex(files: HeresySourceFile[]): HeresyIndex {
  const catalogues = new Map<string, Catalogue>();
  const entries = new Map<string, Node>();
  const entryHome = new Map<string, string>();
  const rules = new Map<string, { rule: Node; home: string }>();
  const profiles = new Map<string, Node>();

  for (const file of files) {
    const isGameSystem = !!file.data?.gameSystem;
    const node: Node | undefined = file.data?.catalogue ?? file.data?.gameSystem;
    if (!node?.id) continue;
    const { name, legion } = cleanCatalogueName(str(node.name));
    catalogues.set(node.id, {
      id: node.id,
      rawName: str(node.name),
      name,
      legion,
      library: node.library === true,
      gameSystem: isGameSystem,
      node,
      imports: arr(node.catalogueLinks)
        .filter((l: Node) => l.importRootEntries === true)
        .map((l: Node) => str(l.targetId)),
    });

    // Every selectionEntry/selectionEntryGroup with an id, at any depth, so
    // entryLinks into nested shared content resolve; the first (outermost)
    // definition wins.
    const visit = (n: Node, depth: number): void => {
      if (depth > 40) return;
      for (const key of ["sharedSelectionEntries", "sharedSelectionEntryGroups", "selectionEntries", "selectionEntryGroups"]) {
        for (const child of arr(n[key])) {
          if (child?.id && !entries.has(child.id)) {
            entries.set(child.id, child);
            entryHome.set(child.id, node.id);
          }
          visit(child, depth + 1);
        }
      }
    };
    visit(node, 0);

    for (const rule of [...arr(node.sharedRules), ...arr(node.rules)]) {
      if (rule?.id && !rules.has(rule.id)) rules.set(rule.id, { rule, home: node.id });
    }
    for (const p of [...arr(node.sharedProfiles), ...arr(node.profiles)]) {
      if (p?.id && !profiles.has(p.id)) profiles.set(p.id, p);
    }
  }
  // Profiles nested in shared entries can also be infoLink targets.
  for (const e of entries.values()) {
    for (const p of arr(e.profiles)) if (p?.id && !profiles.has(p.id)) profiles.set(p.id, p);
  }

  return { catalogues, entries, entryHome, rules, profiles };
}

// === Tree walking ===

/** An entry, group, or entryLink with its target merged in. */
type WNode = {
  name: string;
  kind: "entry" | "group";
  /** Entry type ("unit", "model", "upgrade"); "" for groups. */
  type: string;
  /** The entry/group itself, or the link's target. */
  node: Node;
  link: Node | null;
  ids: string[];
  range: UnitSize | null;
  defaultId: string | undefined;
};

/** "selections" constraints scoped to parent: a missing min is 0, a missing max unbounded. */
function selectionRange(node: Node | null | undefined): UnitSize | null {
  let min: number | null = null;
  let max: number | null = null;
  for (const c of arr(node?.constraints)) {
    if (c.field !== "selections" || c.scope !== "parent") continue;
    const v = Number(c.value);
    if (c.type === "min") min = v;
    else if (c.type === "max") max = v;
  }
  if (min === null && max === null) return null;
  return { min: min ?? 0, max: max ?? Infinity };
}

function toW(raw: Node, kind: "entry" | "group"): WNode {
  return {
    name: clean(raw.name),
    kind,
    type: kind === "entry" ? str(raw.type || "upgrade") : "",
    node: raw,
    link: null,
    ids: [raw.id].filter(Boolean),
    range: selectionRange(raw),
    defaultId: raw.defaultSelectionEntryId,
  };
}

function linkToW(link: Node, index: HeresyIndex): WNode {
  const target = index.entries.get(str(link.targetId));
  const kind = link.type === "selectionEntryGroup" ? "group" : "entry";
  return {
    name: clean(link.name || target?.name),
    kind,
    type: kind === "entry" ? str(target?.type || "upgrade") : "",
    node: target ?? {},
    link,
    ids: [link.id, link.targetId, target?.id].filter(Boolean),
    range: selectionRange(link) ?? selectionRange(target),
    defaultId: target?.defaultSelectionEntryId ?? link.defaultSelectionEntryId,
  };
}

function holders(w: WNode): Node[] {
  return w.link ? [w.node, w.link] : [w.node];
}

function ancestorSet(w: WNode): Set<string> {
  const set = new Set(w.ids);
  for (const h of holders(w)) for (const cl of arr(h.categoryLinks)) if (cl.targetId) set.add(cl.targetId);
  return set;
}

function withAncestor(env: Env, w: WNode): Env {
  if (w.kind !== "entry") return env;
  return { ...env, ancestors: [...env.ancestors, ancestorSet(w)] };
}

function isPool(w: WNode): boolean {
  if (w.type === "model" || w.type === "unit") return false;
  return HERESY_OPTION_POOL_NAME_PATTERN.test(w.name) || HERESY_OPTION_POOL_NAME_PATTERN.test(clean(w.node.name));
}

/** Visible, non-pool children of `w`, read in `env`. */
function children(w: WNode, index: HeresyIndex, env: Env): WNode[] {
  const out: WNode[] = [];
  for (const h of holders(w)) {
    for (const e of arr(h.selectionEntries)) out.push(toW(e, "entry"));
    for (const g of arr(h.selectionEntryGroups)) out.push(toW(g, "group"));
    for (const l of arr(h.entryLinks)) out.push(linkToW(l, index));
  }
  return out.filter((c) => {
    if (isPool(c)) return false;
    if (c.range && c.range.max === 0) return false;
    return !isHidden(holders(c), env);
  });
}

function isModel(w: WNode): boolean {
  return w.type === "model";
}

/** Every visible descendant (not crossing into other units), with the env it is read in. */
function walk(root: WNode, index: HeresyIndex, env: Env, visit: (w: WNode, env: Env) => void): void {
  const seen = new Set<Node>();
  const go = (w: WNode, e: Env, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    visit(w, e);
    const inner = withAncestor(e, w);
    for (const c of children(w, index, inner)) {
      const key = c.link ?? c.node;
      if (seen.has(key)) continue;
      seen.add(key);
      go(c, inner, depth + 1);
    }
  };
  go(root, env, 0);
}

// === Profile extraction ===

function toModelProfile(p: Node): HeresyModelProfile {
  return {
    name: clean(p.name),
    type: characteristic(p, "Type"),
    movement: characteristic(p, "M"),
    weaponSkill: characteristic(p, "WS"),
    ballisticSkill: characteristic(p, "BS"),
    strength: characteristic(p, "S"),
    toughness: characteristic(p, "T"),
    wounds: characteristic(p, "W"),
    initiative: characteristic(p, "I"),
    attacks: characteristic(p, "A"),
    leadership: characteristic(p, "LD"),
    cool: characteristic(p, "CL"),
    willpower: characteristic(p, "WP"),
    intelligence: characteristic(p, "IN"),
    save: characteristic(p, "SAV"),
    invulnerableSave: characteristic(p, "INV"),
  };
}

function toArmouredProfile(p: Node): HeresyArmouredProfile {
  return {
    kind: clean(p.typeName),
    name: clean(p.name),
    stats: arr(p.characteristics).map((c: Node) => ({ name: clean(c.name), value: clean(c.$text) })),
  };
}

function isRangedProfile(p: Node): boolean {
  return p.typeId === HH_RANGED_WEAPON_TYPE_ID || p.typeName === "Psychic Ranged Weapon";
}

function isMeleeProfile(p: Node): boolean {
  return p.typeId === HH_MELEE_WEAPON_TYPE_ID || p.typeName === "Psychic Melee Weapon";
}

export function toRangedWeapon(p: Node): HeresyRangedWeapon {
  return {
    name: clean(p.name),
    range: characteristic(p, "R"),
    firepower: characteristic(p, "FP"),
    rangedStrength: characteristic(p, "RS"),
    ap: characteristic(p, "AP"),
    damage: characteristic(p, "D"),
    specialRules: splitList(characteristic(p, "Special Rules")),
    traits: splitList(characteristic(p, "Traits")),
  };
}

export function toMeleeWeapon(p: Node): HeresyMeleeWeapon {
  return {
    name: clean(p.name),
    initiativeModifier: characteristic(p, "IM"),
    attacksModifier: characteristic(p, "AM"),
    strengthModifier: characteristic(p, "SM"),
    ap: characteristic(p, "AP"),
    damage: characteristic(p, "D"),
    specialRules: splitList(characteristic(p, "Special Rules")),
    traits: splitList(characteristic(p, "Traits")),
  };
}

function dedupe<T>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => {
    const key = JSON.stringify(x);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// === Composition & unit size ===
//
// Counts only model-typed entries (the 40K parser's structural fallback
// counted pure-weapon children as models — the "Contemptor is 4 models" bug).
// A model's own "selections" constraint is its count; a model with none is
// exactly one, or open-ended inside a constrained group, which then clamps
// the total (the approach PR #13 takes for 40K).

type ModelClass = { model: string; min: number; max: number; placements: { w: WNode; env: Env }[] };
type ModelCount = { classes: ModelClass[]; min: number; max: number };

function countModels(w: WNode, index: HeresyIndex, env: Env, inConstrainedGroup: boolean, depth: number): ModelCount | null {
  if (depth > MAX_DEPTH) return null;
  if (isModel(w) && depth > 0) {
    const range = w.range ?? (inConstrainedGroup ? { min: 0, max: Infinity } : { min: 1, max: 1 });
    return { classes: [{ model: w.name, min: range.min, max: range.max, placements: [{ w, env }] }], min: range.min, max: range.max };
  }
  const inner = withAncestor(env, w);
  const constrained = w.kind === "group" && !!w.range;
  const parts = children(w, index, inner)
    .map((c) => {
      const count = countModels(c, index, inner, constrained || (inConstrainedGroup && w.kind === "group"), depth + 1);
      // A non-model entry holding models is a bundle picked `range` times —
      // e.g. a Rapier Battery's 1-4 "Rapier Crew" sub-units of 2 crew each.
      if (!count || c.kind !== "entry" || isModel(c) || !c.range) return count;
      return scaleCount(count, c.range);
    })
    .filter((x): x is ModelCount => x !== null);
  if (parts.length === 0) return null;
  const byName = new Map<string, ModelClass>();
  for (const part of parts) {
    for (const c of part.classes) {
      const existing = byName.get(c.model.toLowerCase());
      if (existing) {
        existing.min += c.min;
        existing.max += c.max;
        existing.placements.push(...c.placements);
      } else byName.set(c.model.toLowerCase(), { ...c, placements: [...c.placements] });
    }
  }
  const classes = [...byName.values()];
  let min = parts.reduce((s, p) => s + p.min, 0);
  let max = parts.reduce((s, p) => s + p.max, 0);
  if (constrained && w.range) {
    min = Math.max(min, w.range.min);
    max = Math.min(max, w.range.max);
  }
  for (const c of classes) {
    const othersMin = classes.reduce((s, o) => (o === c ? s : s + o.min), 0);
    c.max = Math.min(c.max, max - othersMin);
    if (c.min > c.max) c.min = c.max;
  }
  return { classes, min, max };
}

function scaleCount(count: ModelCount, range: UnitSize): ModelCount {
  return {
    classes: count.classes.map((c) => ({ ...c, min: c.min * range.min, max: c.max * range.max })),
    min: count.min * range.min,
    max: count.max * range.max,
  };
}

function unitModelCount(root: WNode, index: HeresyIndex, env: Env): ModelCount | null {
  // A model-typed root (rare in HH3) is itself one model plus any model children.
  const inner = countModels({ ...root, type: "unit" }, index, env, false, 0);
  if (root.type !== "model") return inner;
  const self: ModelClass = { model: root.name, min: 1, max: 1, placements: [{ w: root, env }] };
  if (!inner) return { classes: [self], min: 1, max: 1 };
  return { classes: [self, ...inner.classes], min: 1 + inner.min, max: 1 + inner.max };
}

function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

// === Points ===

function pointsOf(node: Node | null | undefined): number {
  const cost = arr(node?.costs).find((c: Node) => c.typeId === HH_POINTS_COST_TYPE_ID);
  const v = Number(cost?.value);
  return Number.isFinite(v) ? v : 0;
}

function wPoints(w: WNode): number {
  // A link's own cost (rare) wins over its target's.
  const own = arr(w.link?.costs).find((c: Node) => c.typeId === HH_POINTS_COST_TYPE_ID);
  return own ? pointsOf(w.link) : pointsOf(w.node);
}

/**
 * HH3 splits points between the unit entry and each model entry (per the
 * BSData HH3 README). Base cost = unit cost + each model type's cost × its
 * minimum count; each model above the minimum adds its own cost. Cost
 * modifiers (conditional discounts, option-driven changes) are ignored.
 */
function extractPoints(root: WNode, count: ModelCount | null, index: HeresyIndex, env: Env): HeresyPoints | null {
  const costs = root.node.costs ?? root.link?.costs;
  if (!costs && !count) return null;
  let base = wPoints(root);
  const perExtraModel: { model: string; points: number }[] = [];
  for (const c of count?.classes ?? []) {
    const each = Math.max(0, ...c.placements.map((p) => wPoints(p.w)));
    base += each * c.min;
    if (each > 0 && c.max > c.min) perExtraModel.push({ model: c.model, points: each });
  }
  // Priced sub-unit bundles (a Rapier Battery's "Rapier Crew", 40 pts each).
  for (const c of children(root, index, withAncestor(env, root))) {
    if (c.type !== "unit" || !c.range) continue;
    const each = wPoints(c);
    base += each * c.range.min;
    if (each > 0 && c.range.max > c.range.min) perExtraModel.push({ model: c.name, points: each });
  }
  return { base, perExtraModel };
}

// === Wargear ===

function costNote(w: WNode): string {
  const pts = wPoints(w);
  return pts > 0 ? ` (+${pts} pts)` : "";
}

function rangeText(r: UnitSize): string {
  if (!Number.isFinite(r.max)) return r.min > 0 ? `${r.min}+` : "any number";
  if (r.min === r.max) return `${r.max}`;
  return r.min > 0 ? `${r.min}-${r.max}` : `up to ${r.max}`;
}

/** Leaf option names under a choice group (sub-groups are flattened). */
function choiceAlternatives(group: WNode, index: HeresyIndex, env: Env, depth: number): WNode[] {
  if (depth > MAX_DEPTH) return [];
  return children(group, index, env)
    .filter((c) => !isModel(c) && c.type !== "unit")
    .flatMap((c) => (c.kind === "group" ? choiceAlternatives(c, index, env, depth + 1) : [c]));
}

function containsModels(w: WNode, index: HeresyIndex, env: Env, depth: number): boolean {
  if (depth > MAX_DEPTH) return false;
  const inner = withAncestor(env, w);
  return children(w, index, inner).some((c) => isModel(c) || c.type === "unit" || containsModels(c, index, inner, depth + 1));
}

function collectLoadout(w: WNode, index: HeresyIndex, env: Env, out: HeresyModelWargear, depth: number): void {
  if (depth > MAX_DEPTH) return;
  const inner = withAncestor(env, w);
  for (const c of children(w, index, inner)) {
    if (isModel(c) || c.type === "unit" || containsModels(c, index, inner, depth)) continue;
    if (c.kind === "group") {
      if (!c.range) {
        collectLoadout(c, index, inner, out, depth + 1);
        continue;
      }
      const alts = choiceAlternatives(c, index, inner, depth + 1);
      if (alts.length === 0) continue;
      const def = c.defaultId ? alts.find((a) => a.ids.includes(c.defaultId!)) : undefined;
      if (alts.length === 1 && c.range.min >= 1) {
        out.default.push(alts[0].name);
        continue;
      }
      if (def && c.range.min >= 1 && c.range.max === 1) {
        out.default.push(def.name);
        const others = alts.filter((a) => a !== def);
        if (others.length) out.options.push(`${def.name} can be replaced with ${others.length > 1 ? "one of: " : ""}${others.map((a) => `${a.name}${costNote(a)}`).join(", ")}`);
        continue;
      }
      const label = c.name.replace(/[:\s]+$/, "");
      const choose = c.range.min >= 1 ? ` (choose ${rangeText(c.range)})` : /^may /i.test(label) ? "" : ` (may take ${rangeText(c.range)})`;
      out.options.push(`${label}${choose}: ${alts.map((a) => `${a.name}${costNote(a)}`).join(", ")}`);
      continue;
    }
    if (c.range && c.range.min === 0) {
      const max = Number.isFinite(c.range.max) && c.range.max > 1 ? `up to ${c.range.max}x ` : "";
      out.options.push(`May take ${max}${c.name}${costNote(c)}`);
      continue;
    }
    out.default.push(c.name);
  }
}

function extractWargear(root: WNode, count: ModelCount | null, index: HeresyIndex, env: Env): HeresyModelWargear[] {
  const out: HeresyModelWargear[] = [];
  // A single-model unit's wargear reads as that model's, wherever BSData hangs it.
  const single = count && count.classes.length === 1 && count.max === 1 ? count.classes[0].model : null;
  const unitWide: HeresyModelWargear = { model: single ?? (count ? "Whole unit" : root.name), default: [], options: [] };
  collectLoadout(root, index, env, unitWide, 0);
  if (unitWide.default.length || unitWide.options.length) out.push(unitWide);
  for (const cls of count?.classes ?? []) {
    const p = cls.placements[0];
    if (!p || (p.w === root && root.type === "model")) continue;
    const mw: HeresyModelWargear = { model: cls.model, default: [], options: [] };
    collectLoadout(p.w, index, p.env, mw, 0);
    const existing = out.find((o) => o.model === mw.model);
    if (existing) {
      existing.default.unshift(...mw.default);
      existing.options.unshift(...mw.options);
      existing.default = [...new Set(existing.default)];
      existing.options = [...new Set(existing.options)];
      continue;
    }
    mw.default = [...new Set(mw.default)];
    mw.options = [...new Set(mw.options)];
    if (mw.default.length || mw.options.length) out.push(mw);
  }
  return out;
}

// === Rules, traits, reactions ===

type RuleHit = { name: string; conditional: boolean };

function linkedRules(w: WNode, index: HeresyIndex, env: Env): RuleHit[] {
  const out: RuleHit[] = [];
  for (const h of holders(w)) {
    for (const link of arr(h.infoLinks)) {
      if (link.type !== "rule") continue;
      const target = index.rules.get(str(link.targetId));
      if (!target) continue;
      const nodes = [link];
      const conditional = isConditionallyShown(nodes, env);
      if (isHidden(nodes, env) && !conditional) continue;
      const { name, uncertain, alternatives } = applyNameModifiers(clean(target.rule.name), nodes, env);
      out.push({ name: uncertain && /\(X\)/i.test(name) ? describeUncertainName(name, alternatives) : name, conditional });
    }
  }
  return out;
}

function linkedProfiles(w: WNode, index: HeresyIndex, env: Env): Node[] {
  const out: Node[] = [];
  for (const h of holders(w)) {
    for (const link of arr(h.infoLinks)) {
      if (link.type !== "profile") continue;
      if (isHidden([link], env)) continue;
      const target = index.profiles.get(str(link.targetId));
      if (target) out.push(target);
    }
  }
  return out;
}

// === Unit parsing ===

function parseUnit(
  entry: Node,
  link: Node | null,
  homeId: string,
  index: HeresyIndex,
): Omit<HeresyUnit, "availableIn"> | null {
  const home = index.catalogues.get(homeId);
  const root: WNode = link ? linkToW(link, index) : toW(entry, "entry");
  root.name = clean(entry.name); // the datasheet's own name, not a link rename
  const env: Env = { primaryCatalogueId: home && !home.library ? home.id : undefined, ancestors: [] };

  const models: HeresyModelProfile[] = [];
  const armoured: HeresyArmouredProfile[] = [];
  const ranged: HeresyRangedWeapon[] = [];
  const melee: HeresyMeleeWeapon[] = [];
  const wargearRules: { name: string; description: string }[] = [];
  const traits: string[] = [];
  const reactions: string[] = [];

  const consumeProfile = (p: Node, fromModel: boolean, fromUnitOrModel = fromModel): void => {
    if (p.typeId === HH_MODEL_PROFILE_TYPE_ID) {
      if (fromModel) models.push(toModelProfile(p));
    } else if (ARMOURED_PROFILE_TYPE_NAMES.has(clean(p.typeName))) {
      if (fromModel) armoured.push(toArmouredProfile(p));
    } else if (isRangedProfile(p)) ranged.push(toRangedWeapon(p));
    else if (isMeleeProfile(p)) melee.push(toMeleeWeapon(p));
    else if (p.typeId === HH_WARGEAR_TYPE_ID) {
      const description = characteristic(p, "Description") || characteristic(p, "Summary");
      if (description) wargearRules.push({ name: clean(p.name), description });
    } else if (p.typeId === HH_TRAITS_TYPE_ID) {
      if (fromUnitOrModel) traits.push(clean(p.name));
    } else if (p.typeId === HH_REACTION_TYPE_ID) {
      if (fromUnitOrModel) reactions.push(clean(p.name));
    }
  };

  // Rules on the unit itself and on its model entries ("Sergeant"-only rules).
  const unitRules = linkedRules(root, index, env);
  const modelRules: { model: string; rules: RuleHit[] }[] = [];

  walk(root, index, env, (w, e) => {
    const fromModel = isModel(w) || w === root;
    for (const p of arr(w.node.profiles)) {
      if (isHidden([p], e)) continue;
      consumeProfile(p, fromModel);
    }
    // Profile infoLinks: traits/reactions on the unit and its models; wargear
    // rules on wargear entries.
    for (const p of linkedProfiles(w, index, e)) consumeProfile(p, false, fromModel || w.type === "unit");
    if (isModel(w) && w !== root) modelRules.push({ model: w.name, rules: linkedRules(w, index, e) });
  });

  if (models.length === 0 && armoured.length === 0) return null;

  const count = unitModelCount(root, index, env);
  const composition: HeresyCompositionEntry[] = (count?.classes ?? [])
    .filter((c) => c.max > 0)
    .map((c) => ({ model: c.model, min: c.min, max: finite(c.max, Math.max(c.min, 1)) }));
  const unitSize: UnitSize = count
    ? { min: Math.max(1, count.min), max: Math.max(1, count.min, finite(count.max, composition.reduce((s, c) => s + c.max, 0))) }
    : { min: 1, max: 1 };

  // A rule every model type has is a unit rule; otherwise it is tagged with the models that have it.
  const specialRules: string[] = [];
  const conditionalRules: string[] = [];
  const push = (list: string[], name: string) => {
    if (!list.includes(name)) list.push(name);
  };
  for (const r of unitRules) push(r.conditional ? conditionalRules : specialRules, r.name);
  const modelNames = [...new Set(modelRules.map((m) => m.model))];
  const allModelRuleNames = new Set(modelRules.flatMap((m) => m.rules.map((r) => r.name)));
  for (const ruleName of allModelRuleNames) {
    const holdersOf = modelRules.filter((m) => m.rules.some((r) => r.name === ruleName));
    const conditional = holdersOf.every((m) => m.rules.find((r) => r.name === ruleName)!.conditional);
    const who = [...new Set(holdersOf.map((m) => m.model))];
    const label = who.length === modelNames.length || modelNames.length <= 1 ? ruleName : `${ruleName} (${who.join(", ")})`;
    push(conditional ? conditionalRules : specialRules, label);
  }

  return {
    id: str(link?.id || entry.id),
    name: clean(entry.name),
    faction: home?.name ?? "",
    models: dedupe(models),
    armoured: dedupe(armoured),
    composition,
    unitSize,
    specialRules,
    conditionalRules: conditionalRules.filter((r) => !specialRules.includes(r)),
    traits: [...new Set(traits)],
    reactions: [...new Set(reactions)],
    rangedWeapons: dedupe(ranged),
    meleeWeapons: dedupe(melee),
    wargear: extractWargear(root, count, index, env),
    wargearRules: dedupe(wargearRules),
    points: extractPoints(root, count, index, env),
    gameSystem: "horus-heresy-3e",
  };
}

// === Unit attribution ===
//
// Each datasheet is emitted once, under the catalogue that defines it. The
// Legiones Astartes library defines the ~140 generic Astartes units that
// every Legion (plus Blackshields and Shattered Legions) imports via an
// importRootEntries catalogueLink; the 40K pipeline's "import every linked
// catalogue's root entries" step would emit each of them ~20 times, and would
// also list allied Mechanicum units as Custodes, Militia, etc. Instead, the
// armies that can field a unit are recorded in `availableIn`: catalogues that
// root-link it, plus (transitively) catalogues importing one of those.

function computeAvailability(index: HeresyIndex, linkers: Set<string>): string[] {
  const reach = new Set(linkers);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cat of index.catalogues.values()) {
      if (reach.has(cat.id)) continue;
      if (cat.imports.some((id) => reach.has(id))) {
        reach.add(cat.id);
        changed = true;
      }
    }
  }
  return [...reach]
    .map((id) => index.catalogues.get(id))
    .filter((c): c is Catalogue => !!c && !c.library && !c.gameSystem)
    .map((c) => c.name);
}

export function parseHeresyUnits(index: HeresyIndex): HeresyUnit[] {
  type Candidate = { entry: Node; link: Node | null; home: string; linkers: Set<string> };
  const candidates = new Map<string, Candidate>();

  for (const cat of index.catalogues.values()) {
    for (const link of arr(cat.node.entryLinks)) {
      if (link.type !== "selectionEntry") continue;
      const target = index.entries.get(str(link.targetId));
      if (!target || (target.type !== "unit" && target.type !== "model")) continue;
      if (isHidden([link, target], { primaryCatalogueId: cat.id, ancestors: [] })) continue;
      const home = index.entryHome.get(target.id) ?? cat.id;
      const existing = candidates.get(target.id);
      if (existing) existing.linkers.add(cat.id);
      else candidates.set(target.id, { entry: target, link: home === cat.id ? link : null, home, linkers: new Set([cat.id]) });
      // Prefer the defining catalogue's own link (its id and modifiers).
      if (existing && home === cat.id && !existing.link) existing.link = link;
    }
    for (const entry of arr(cat.node.selectionEntries)) {
      if (entry.type !== "unit" && entry.type !== "model") continue;
      if (isHidden([entry], { primaryCatalogueId: cat.id, ancestors: [] })) continue;
      if (!candidates.has(entry.id)) candidates.set(entry.id, { entry, link: null, home: cat.id, linkers: new Set([cat.id]) });
    }
  }

  const units: HeresyUnit[] = [];
  for (const c of candidates.values()) {
    const parsed = parseUnit(c.entry, c.link, c.home, index);
    if (!parsed) continue;
    const homeName = index.catalogues.get(c.home)?.name;
    units.push({
      ...parsed,
      availableIn: computeAvailability(index, c.linkers)
        .filter((n) => n !== homeName)
        .sort((a, b) => a.localeCompare(b)),
    });
  }
  return units.sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));
}

// === Weapons table ===

/** Every weapon entry (with its profiles) in the data, deduplicated by content. */
export function parseHeresyWeapons(index: HeresyIndex): HeresyWeapon[] {
  const out: HeresyWeapon[] = [];
  const seen = new Set<string>();
  for (const [id, e] of index.entries) {
    const profiles = arr(e.profiles);
    const ranged = profiles.filter((p) => p.typeId === HH_RANGED_WEAPON_TYPE_ID).map(toRangedWeapon);
    const melee = profiles.filter((p) => p.typeId === HH_MELEE_WEAPON_TYPE_ID).map(toMeleeWeapon);
    if (ranged.length === 0 && melee.length === 0) continue;
    const weapon: HeresyWeapon = {
      name: clean(e.name),
      source: index.catalogues.get(index.entryHome.get(id) ?? "")?.name ?? "",
      ranged,
      melee,
      gameSystem: "horus-heresy-3e",
    };
    const key = JSON.stringify([weapon.name.toLowerCase(), ranged, melee]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(weapon);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

// === Special rules ===

/**
 * "**Bold summary.**\n\nBody" → summary "Bold summary." Some rules open with a
 * quoted line instead ("\"The Deep Strike Special Rule allows...\""), which is
 * used the same way.
 */
function splitSummary(description: string): string {
  const bold = description.match(/^\s*\*\*(.+?)\*\*/s);
  if (bold) return clean(bold[1]);
  const quoted = description.match(/^\s*"([^"\n]+)"/);
  if (quoted) return clean(quoted[1]);
  return "";
}

/** Fix an escaping artefact in the data: 1"" (inches) → 1". */
function tidyRuleText(text: string): string {
  return text.replace(/(\d)""/g, '$1"').trim();
}

export function parseHeresyRules(index: HeresyIndex): HeresySpecialRule[] {
  const out: HeresySpecialRule[] = [];
  const seen = new Set<string>();
  for (const { rule, home } of index.rules.values()) {
    const description = tidyRuleText(str(rule.description));
    if (!description) continue; // a stub with no text yet
    const name = clean(rule.name);
    const key = `${name.toLowerCase()}::${description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      aliases: arr<string>(rule.alias).map(clean).filter(Boolean),
      summary: splitSummary(description),
      description,
      source: index.catalogues.get(home)?.name ?? "",
      gameSystem: "horus-heresy-3e",
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// === Profile-based rules: Reactions, Gambits, psychic powers, wargear, assets, detachments ===

/**
 * Profile typeName → rule kind. These are rules the data stores as profiles
 * (Summary/Trigger/Cost/Target/Process columns) rather than as sharedRules:
 * the 72 Reactions, 61 Gambits, psychic powers and reactions, standalone
 * wargear, battlefield assets and the force organisation detachments.
 */
const PROFILE_RULE_KINDS: Record<string, HeresyRuleKind> = {
  Reaction: "reaction",
  "Psychic Reaction": "psychic reaction",
  Gambit: "gambit",
  "Psychic Power": "psychic power",
  Wargear: "wargear",
  Asset: "asset",
  "Detachment Description": "detachment",
};

/** Group labels that say what a profile is, not who grants it ("Advanced Reaction", "Gambit"). */
const GENERIC_CONTEXT = /^(advanced reactions?|reactions?|gambits?|psychic (powers?|reactions?|disciplines?)|wargear|options?|rite of war|warlord|detachments?|\d+\).*)$/i;

/** "Detachment Composition" lines → one bullet each; other columns as "**Name:** value" paragraphs. */
function profileText(p: Node): { summary: string; description: string } {
  let summary = "";
  const parts: string[] = [];
  for (const c of arr(p.characteristics)) {
    const label = clean(c.name).replace(/:$/, "");
    const value = tidyRuleText(str(c.$text ?? c["#text"] ?? ""));
    if (!value) continue;
    if (label === "Summary") summary = clean(value);
    else if (label === "Description") parts.push(value);
    else if (label === "Detachment Composition") parts.push(value.split(/\n+/).map((l) => `- ${l.trim()}`).filter((l) => l !== "- ").join("\n"));
    else parts.push(`**${label}:** ${value}`);
  }
  return { summary, description: parts.join("\n\n") };
}

/**
 * Every profile-based rule in the data, deduplicated by name + text. Walks
 * each file's tree so a Reaction or Gambit can name what grants it (its
 * nearest unit, upgrade or Rite of War ancestor).
 */
export function parseHeresyProfileRules(files: HeresySourceFile[]): HeresySpecialRule[] {
  const out: HeresySpecialRule[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const root: Node | undefined = file.data?.catalogue ?? file.data?.gameSystem;
    if (!root?.id) continue;
    const source = cleanCatalogueName(str(root.name)).name;
    const visit = (n: Node, ancestors: string[], depth: number): void => {
      if (depth > 40 || !n || typeof n !== "object") return;
      for (const p of arr(n.profiles)) {
        const kind = PROFILE_RULE_KINDS[str(p?.typeName)];
        if (!kind || p.hidden === true) continue;
        const name = clean(p.name);
        if (!name || name === "New Profile") continue;
        const { summary, description } = profileText(p);
        if (!description && !summary) continue;
        const key = `${kind}::${name.toLowerCase()}::${description}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const context = [...ancestors].reverse().find((a) => a !== name && !GENERIC_CONTEXT.test(a)) ?? "";
        out.push({
          name,
          aliases: [],
          summary,
          description: description || summary,
          source,
          gameSystem: "horus-heresy-3e",
          kind,
          ...(context ? { context } : {}),
        });
      }
      const here = n === root ? [] : [...ancestors, clean(n.name)].filter(Boolean);
      // forceEntries: the game system's force organisation charts, which hold the Detachment Descriptions
      for (const key of ["sharedSelectionEntries", "sharedSelectionEntryGroups", "selectionEntries", "selectionEntryGroups", "forceEntries"]) {
        for (const child of arr(n[key])) visit(child, here, depth + 1);
      }
      // sharedProfiles live directly on the root: give them a pass of their own
      if (n === root) for (const p of arr(n.sharedProfiles)) visit({ profiles: [p] }, [], depth + 1);
    };
    visit(root, [], 0);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

export function parseHeresyFactions(index: HeresyIndex): HeresyFaction[] {
  return [...index.catalogues.values()]
    .filter((c) => !c.gameSystem)
    .filter((c) => !c.library || arr(c.node.entryLinks).length > 0)
    .map((c) => ({ name: c.name, legion: c.legion, library: c.library }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Parse a full set of HH3 data files (the game system plus every catalogue). */
export function parseHeresyData(files: HeresySourceFile[]): HeresyParseResult {
  const index = buildHeresyIndex(files);
  return {
    units: parseHeresyUnits(index),
    weapons: parseHeresyWeapons(index),
    rules: parseHeresyRules(index),
    profileRules: parseHeresyProfileRules(files),
    factions: parseHeresyFactions(index),
  };
}
