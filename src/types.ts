// === Game Modes ===

export type GameMode = "40k" | "40k_10e" | "40k_11e" | "combat_patrol" | "kill_team" | "heresy";

export type GameSystem = "wh40k-10e" | "wh40k-11e" | "wh40k-killteam" | "horus-heresy-3e";

// === Unit Data (from BSData .cat files) ===

export type UnitProfile = {
  name: string;
  movement: string;
  toughness: string;
  save: string;
  wounds: string;
  leadership: string;
  objectiveControl: string;
};

export type KillTeamOperativeProfile = {
  name: string;
  apl: string;
  movement: string;
  save: string;
  wounds: string;
};

export type RangedWeapon = {
  name: string;
  range: string;
  attacks: string;
  ballisticSkill: string;
  strength: string;
  armourPenetration: string;
  damage: string;
  keywords: string[];
};

export type MeleeWeapon = {
  name: string;
  range: string;
  attacks: string;
  weaponSkill: string;
  strength: string;
  armourPenetration: string;
  damage: string;
  keywords: string[];
};

export type KillTeamWeapon = {
  name: string;
  attacks: string;
  hit: string;
  damage: string;
  weaponRules: string;
  type: "ranged" | "melee";
};

export type Ability = {
  name: string;
  description: string;
};

export type UnitSize = {
  min: number;
  max: number;
};

/**
 * One model type in a unit and how many of it the unit can include, e.g.
 * `{ model: "Intercessor Sergeant", min: 1, max: 1 }` plus
 * `{ model: "Intercessor", min: 4, max: 9 }`. Loadout variants BSData models
 * as separate entries ("Intercessor w/ Grenade Launcher", "Boy w/ Big
 * shoota") are folded into their base model type; their weapon swaps are in
 * `Unit.wargear` instead.
 */
export type CompositionEntry = {
  model: string;
  min: number;
  max: number;
};

/**
 * One model's wargear, as readable text rather than a rules engine: what it is
 * equipped with by default, then each option the datasheet allows. A choice
 * with no default in the data reads "A or B" / "one of (A, B, C)" in `default`.
 *
 * Example (Space Marine Captain):
 *   default: ["Heavy Bolt Pistol", "Master-crafted bolter", "Power fist or Master-crafted power weapon"]
 *   options: ["Alternative loadout: Master-crafted power weapon, Relic Shield, Heavy Bolt Pistol (replaces Master-crafted bolter)", ...]
 */
export type ModelWargear = {
  model: string;
  default: string[];
  options: string[];
};

export type Unit = {
  id: string;
  name: string;
  faction: string;
  keywords: string[];
  profiles: UnitProfile[];
  rangedWeapons: RangedWeapon[];
  meleeWeapons: MeleeWeapon[];
  abilities: Ability[];
  points: number | null;
  unitSize: UnitSize;
  /** Model types and counts that make up the unit; sums to `unitSize`. */
  composition: CompositionEntry[];
  /** Default loadout and options per model type. Empty when the data has none. */
  wargear: ModelWargear[];
  gameSystem: GameSystem;
};

export type KillTeamOperative = {
  id: string;
  name: string;
  faction: string;
  keywords: string[];
  profile: KillTeamOperativeProfile;
  weapons: KillTeamWeapon[];
  abilities: Ability[];
  uniqueActions: Ability[];
  gameSystem: GameSystem;
};

// === Horus Heresy 3rd Edition (from BSData/horus-heresy-3rd-edition) ===
//
// A separate data model, like Kill Team's: HH3 stat lines share almost no
// columns with 40K's (WS/BS/S/T/W/I/A/LD/CL/WP/IN/SAV/INV; weapons carry
// R/FP/RS/AP/D or IM/AM/SM/AP/D), so forcing them into Unit/UnitProfile would
// be lossy and invite reading one game's stats as the other's. Field values
// are the data's own strings, unmodified.

/** An infantry/walker/cavalry/character stat line (BSData profile type "Profile"). */
export type HeresyModelProfile = {
  name: string;
  /** Model Type and Sub-Types, e.g. "Infantry (Sergeant)", "Walker". */
  type: string;
  movement: string;
  weaponSkill: string;
  ballisticSkill: string;
  strength: string;
  toughness: string;
  wounds: string;
  initiative: string;
  attacks: string;
  leadership: string;
  cool: string;
  willpower: string;
  intelligence: string;
  save: string;
  invulnerableSave: string;
};

/**
 * A Vehicle, Knight, Titan (Head/Carapace/Legs/Arms), Ordinatus or
 * Battlefield fortification profile. These have different columns per kind
 * (armour facings, HP, Transport Capacity...), so the characteristics are
 * kept in the data's own order and naming.
 */
export type HeresyArmouredProfile = {
  /** The BSData profile type, e.g. "Vehicle", "Knight", "Titan Head". */
  kind: string;
  name: string;
  stats: { name: string; value: string }[];
};

export type HeresyRangedWeapon = {
  name: string;
  range: string;
  firepower: string;
  rangedStrength: string;
  ap: string;
  damage: string;
  /** Weapon special rules with their values, e.g. ["Heavy (FP)", "Deflagrate (6)"]. */
  specialRules: string[];
  /** Weapon traits, e.g. ["Volkite"]. */
  traits: string[];
};

/**
 * HH3 melee weapons have no Strength/Attacks/Initiative of their own: IM, AM
 * and SM modify the bearer's characteristic ("S" = the bearer's Strength,
 * "+4" = the bearer's Strength +4).
 */
export type HeresyMeleeWeapon = {
  name: string;
  initiativeModifier: string;
  attacksModifier: string;
  strengthModifier: string;
  ap: string;
  damage: string;
  specialRules: string[];
  traits: string[];
};

export type HeresyCompositionEntry = { model: string; min: number; max: number };

/** One model's (or the whole unit's) default wargear and options, as readable text. */
export type HeresyModelWargear = {
  model: string;
  default: string[];
  options: string[];
};

export type HeresyPoints = {
  /** Cost of the unit at its minimum size, with no options. */
  base: number;
  /** Extra cost per additional model above the minimum, by model type. */
  perExtraModel: { model: string; points: number }[];
};

export type HeresyUnit = {
  id: string;
  name: string;
  /** The catalogue the datasheet is defined in, e.g. "Legiones Astartes", "Ultramarines", "Mechanicum". */
  faction: string;
  /** Armies (BSData roster catalogues) that can include this unit, other than `faction` itself. */
  availableIn: string[];
  models: HeresyModelProfile[];
  armoured: HeresyArmouredProfile[];
  composition: HeresyCompositionEntry[];
  unitSize: UnitSize;
  /** Special rules with their values, e.g. "Bulky (6)", "Line (2)"; "(Sergeant)" marks a rule only some models have. */
  specialRules: string[];
  /**
   * Rules the data hides by default and shows only for some army options
   * (a Rite of War, Blackshields, an upgrade...). Listed separately so a
   * static lookup never presents them as always-on.
   */
  conditionalRules: string[];
  /** Trait tags, e.g. "[Allegiance]", "[Legiones Astartes]", "Smokescreen". */
  traits: string[];
  /** Names of Reactions the unit grants (full Reaction text is not bundled yet). */
  reactions: string[];
  rangedWeapons: HeresyRangedWeapon[];
  meleeWeapons: HeresyMeleeWeapon[];
  wargear: HeresyModelWargear[];
  /** Wargear items with rules text (e.g. a Vexilla, Augury scanner) the unit can have. */
  wargearRules: { name: string; description: string }[];
  points: HeresyPoints | null;
  gameSystem: "horus-heresy-3e";
};

/** A weapon as listed in the data (one entry may have several profiles, e.g. plasma gun Maximal/Sustained). */
export type HeresyWeapon = {
  name: string;
  /** Catalogue the weapon entry is defined in, e.g. "Weapons" (the shared armoury), "Mechanicum". */
  source: string;
  ranged: HeresyRangedWeapon[];
  melee: HeresyMeleeWeapon[];
  gameSystem: "horus-heresy-3e";
};

export type HeresySpecialRule = {
  /** As written in the data, e.g. "Bulky (X)", "Deep Strike". */
  name: string;
  /** Alternate names from the data (e.g. "Bulky"). */
  aliases: string[];
  /** The rule's bold one-line summary, when the text starts with one. */
  summary: string;
  description: string;
  /** Catalogue the rule is defined in, e.g. "Special Rules", "Horus Heresy 3rd Edition". */
  source: string;
  gameSystem: "horus-heresy-3e";
  /** What kind of rule this is; absent = a special rule (the original corpus). */
  kind?: HeresyRuleKind;
  /** Where it comes from inside the source, e.g. the unit or Rite of War that grants a Reaction, or "Principles of Combat > Tactical Statuses". */
  context?: string;
  /** Public page with the full rule, when there is one (the Wahapedia core rules). */
  url?: string;
};

export type HeresyRuleKind =
  | "special rule"
  | "reaction"
  | "psychic reaction"
  | "gambit"
  | "psychic power"
  | "wargear"
  | "asset"
  | "detachment"
  | "status"
  | "core rule"
  | "mission"
  | "rite of war"
  | "army rule";

export type HeresyFaction = {
  /** Cleaned catalogue name, e.g. "Ultramarines". */
  name: string;
  /** Legion number for the Legion catalogues, e.g. "XIII"; null otherwise. */
  legion: string | null;
  /** True for BSData library catalogues (not directly an army), e.g. "Legiones Astartes". */
  library: boolean;
};

// === Rules Content (hand-curated) ===

export type KeywordDefinition = {
  name: string;
  description: string;
  plainEnglish: string;
  gameModes: GameMode[];
  examples?: string[];
};

export type Phase = {
  name: string;
  order: number;
  steps: string[];
  tips: string[];
  gameMode: GameMode;
};

export type TurnSequence = {
  gameMode: GameMode;
  phases: Phase[];
};

// === Detachments & Enhancements (from BSData) ===

export type Detachment = {
  id: string;
  name: string;
  faction: string;
  ability: { name: string; description: string };
  /** 1-3, from BSData's "Detachment Points" cost. 11th Edition only — always null for 10e data. */
  detachmentPoints: number | null;
  /** Which Force Disposition(s) this detachment can select when mustering. 11th Edition only — always [] for 10e data. */
  dispositions: Disposition[];
  /**
   * Mutual-exclusion tag(s) from BSData (e.g. "Nightmare", "Doomed", "Grace",
   * "Covens"). Detachments sharing any tag in this list cannot both be used
   * in the same army — e.g. Chaos Space Marines' Murdertalon Raiders and
   * Nightmare Hunt both carry "Nightmare" and are mutually exclusive. 11th
   * Edition only — always [] for 10e data. Usually empty; most detachments
   * have no such restriction.
   */
  restrictionTags: string[];
  gameSystem: GameSystem;
};

export type Enhancement = {
  id: string;
  name: string;
  faction: string;
  detachment: string;
  description: string;
  points: number | null;
  gameSystem: GameSystem;
};

// === Crusade Honours (from BSData) ===
//
// Crusade Battle Traits, Crusade Relics, and Battle Scars are deliberately
// NOT merged into Unit.abilities — every named character across every
// faction shares the same handful of Crusade-only ability pools (see
// UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN in fetch-data.ts), so duplicating
// them onto each unit would bloat the dataset without adding unit-specific
// signal. This is a separate, queryable data domain instead. 11th Edition
// only (BSData/wh40k-10e's XML schema wasn't investigated for this content;
// scope matched to the DetachmentPoints/Disposition precedent).

/** Where a Crusade Honour comes from: the universal rulebook pool, a
 * faction's own codex-specific pool, or a campaign supplement's pool. */
export type CrusadeHonourScope = "generic" | "faction" | "campaign";

export type CrusadeHonourCategory = "battleTrait" | "relic" | "battleScar" | "boon";

/** Crusade Relics are tiered by rarity/power; only present when category === "relic". */
export type CrusadeRelicTier = "Antiquity" | "Legendary" | "Artificer";

export type CrusadeHonour = {
  id: string;
  name: string;
  description: string;
  category: CrusadeHonourCategory;
  scope: CrusadeHonourScope;
  /** Set when scope === "faction" (e.g. "Chaos Space Marines"). */
  faction: string | null;
  /** Set when scope === "campaign" (e.g. "Tyrannic War", "Armageddon"). */
  campaign: string | null;
  relicTier: CrusadeRelicTier | null;
  gameSystem: GameSystem;
};

// === Stratagems (hand-curated) ===

export type Stratagem = {
  name: string;
  faction: string;
  detachment: string | null;
  type: "battle_tactic" | "epic_deed" | "strategic_ploy" | "wargear" | "core";
  cpCost: number;
  phase: string;
  when: string;
  target: string;
  effect: string;
  restrictions?: string;
  gameModes: GameMode[];
};

// === Force Dispositions & Mission Matchups (hand-curated) ===

export type Disposition =
  | "Take and Hold"
  | "Purge the Foe"
  | "Reconnaissance"
  | "Priority Assets"
  | "Disruption";

export type MissionMatchup = {
  dispositionA: Disposition;
  dispositionB: Disposition;
  missionA: string;
  missionB: string;
};

// === Kill Team Ploys (hand-curated) ===

export type Ploy = {
  name: string;
  faction: string;
  type: "strategic" | "tactical";
  cpCost: number;
  when: string;
  effect: string;
  restrictions?: string;
  gameMode: "kill_team";
};
