/**
 * Warhammer 40,000 11th Edition core rules, one entry per rule a player might
 * ask about at the table.
 *
 * The summaries are in our own words, written from two sources:
 * - Current rules: the Warhammer 40,000 app rulebook, version 2.7.1 (October
 *   2026), read as the Core Rules and Rules Appendix pages of a text copy. It
 *   includes the appendix's Universal Rules Updates and Muster Armies (25).
 * - Cross-check: GW's free Core Rules PDF (undated, the June print):
 *   https://assets.warhammer-community.com/eng_01-06_warhammer40k_new40k_core_rules-was6fbu1ix-hfewhmxyiy.pdf
 * Where they differ, the summary follows the app. It states its version and
 * date; the PDF states neither, so "the app is newer" is a judgement.
 *
 * Differences from the June PDF that change play: objective consolidation
 * (12.08), Hidden (13.09), Gone to Ground (13.11.01), Dedicated Transports
 * (18.01), emergency disembark (18.05), assault and shock disembark (18.06,
 * 18.07), reserves at the end of the battle (20.01.02), [EXTRA ATTACKS]
 * (24.11.01), [PRECISION] with [DEVASTATING WOUNDS] (24.28.01), [TORRENT]
 * (24.37.01) and Damaged (24.39). The app removes three stratagems from section
 * 15 only on Combat Patrol pages; they stay here (Combat Patrol's mission bars
 * them itself).
 *
 * Open points, not resolved here:
 * - The text copy shows the app's FAQ and Errata boxes collapsed ("FAQ Show",
 *   "ERRATA Show"), so their contents were not read. Entries marked "June PDF
 *   FAQ", and the FAQ answers folded into Overrun Fight and Scout Move, come
 *   only from the PDF and could have been superseded.
 * - Shock disembark (18.07): set-up normally requires being unengaged (03.02),
 *   yet the move speaks of models that started engaged staying engaged. The app
 *   doesn't say how the two fit, and the summary reports both.
 * - 13.06: see the comment on Terrain and Movement. Both sources read the same.
 *
 * Source notes:
 * - ruleRef is the rule's number; several subsections (e.g. 12.04.01) are only
 *   numbered in the app.
 * - The dice values in the hit, wound and save tables (05.01-05.04) are icons
 *   that text extraction drops. They were read from pages 18-19 of the PDF.
 * - Core abilities already in keywords.ts (Lethal Hits, Deep Strike, ...) are
 *   not repeated here, and the core stratagems' own text stays in stratagems.ts;
 *   CORE_STRATAGEM_REFS gives their rule numbers.
 */

export interface CoreRule {
  name: string;
  /** Rule number, e.g. "18.05". */
  ruleRef: string;
  /** How people say it aloud. Matched like the name. */
  aliases: string[];
  summary: string;
}

/** Rule numbers of the core stratagems, whose text lives in stratagems.ts. */
export const CORE_STRATAGEM_REFS: Record<string, string> = {
  "Command Re-Roll": "15.02",
  "Epic Challenge": "15.03",
  "Insane Bravery": "15.04",
  "Explosives": "15.05",
  "Crushing Impact": "15.06",
  "Rapid Ingress": "15.07",
  "Fire Overwatch": "15.08",
  "Smokescreen": "15.10",
  "Heroic Intervention": "15.11",
  "Counteroffensive": "15.12",
};

export const CORE_RULES_11E: CoreRule[] = [
  // === 01 Core concepts ===
  {
    name: "Units and Models",
    ruleRef: "01.02",
    aliases: ["unit", "units", "model", "models", "base", "friendly units", "enemy units", "friendly and enemy"],
    summary:
      "A unit is one or more models acting as a group, and a model's base counts as part of the model. Friendly means your army, enemy means your opponent's, and a rule that names neither affects both. Anything applied to a unit applies to every model in it.",
  },
  {
    name: "Active Player",
    ruleRef: "01.03",
    aliases: ["opposing player", "active and opposing player", "who is the active player", "controlling player", "armies"],
    summary:
      "It's normally whoever's turn it is, and the other player is the opposing player. While a unit is moving, or from being selected to shoot or fight until its attacks are done, that unit's controller is active instead. Between turns, the player who goes first in the battle round is active. The controlling player of a model is the one whose army it's in.",
  },
  {
    name: "Measuring Distances",
    ruleRef: "01.04",
    aliases: ["measuring", "measure", "distance", "distances", "can i pre-measure", "pre-measure", "premeasure"],
    summary:
      "Everything is in inches and you may measure at any time. Unless a rule says otherwise, measure to and from the closest part of a model's base (FRAME models use the closest point of the model instead, 17.02).",
  },
  {
    name: "Dice",
    ruleRef: "01.05",
    aliases: ["d6", "d3", "2d6", "dice rolls", "rolling dice", "how do i roll a d3", "d6+1"],
    summary:
      "All dice are six-sided. 3+ means 3 or higher, and 4-6 means any result in that range. 2D6 means roll two and add them, and D6+1 means roll and add 1. For a D3, roll a D6 and halve it, rounding up.",
  },
  {
    name: "Leadership Rolls",
    ruleRef: "01.06",
    aliases: ["leadership roll", "leadership test", "leadership", "ld roll", "ld test"],
    summary:
      "Roll 2D6. The roll succeeds if the total matches or beats at least one Ld characteristic in the unit, and otherwise it fails. The rule that called for the roll says what happens next.",
  },
  {
    name: "Battle-shock",
    ruleRef: "01.07",
    aliases: ["battle-shocked", "battle shock", "battleshock", "battleshocked", "battle-shock roll", "battle shock roll", "battle-shock test", "morale", "shaken", "battleshock test"],
    summary:
      "A battle-shock roll is a leadership roll: 2D6, matching or beating a Ld in the unit passes, and failing makes the unit battle-shocked. While battle-shocked, its models' OC becomes '-', you can't target it with stratagems, it can't start an action, and any action it has started can't complete.",
  },

  // === 02 Datasheets ===
  {
    name: "Model Characteristics",
    ruleRef: "02.02",
    aliases: ["profile", "profiles", "stat line", "stats", "characteristics", "move characteristic", "toughness", "save characteristic", "wounds characteristic", "leadership characteristic", "objective control", "oc", "oc characteristic", "m t sv w ld oc"],
    summary:
      "M is how far a model moves ('-' means it can be set up but never moved). T is toughness, Sv is its armour save, and InSv is an invulnerable save if it has one. W is how much damage it takes, and at 0 or fewer it's destroyed. Ld is a target for leadership rolls, and OC is how strongly it holds objectives ('-' means it can't control them).",
  },
  {
    name: "Weapon Characteristics",
    ruleRef: "02.04",
    aliases: ["weapon profile", "weapon stats", "range", "attacks", "ballistic skill", "bs", "weapon skill", "ws", "strength", "armour penetration", "armor penetration", "ap", "damage", "melee weapon", "ranged weapon"],
    summary:
      "R is range ('Melee' marks a melee weapon) and A is how many attack dice it uses. BS (ranged) or WS (melee) is the roll needed to hit. S is compared to the target's toughness to wound, AP is a modifier applied to the save (e.g. -1), and D is the damage each attack inflicts.",
  },
  {
    name: "Datasheet Keywords",
    ruleRef: "02.05",
    aliases: ["keywords", "faction keywords", "what is a keyword"],
    summary:
      "Datasheets list faction keywords and other keywords, shown in capitals. Faction keywords matter when choosing what goes in your army, but otherwise the two work the same. A rule tied to a keyword applies only to units that have it, and singular and plural count as the same keyword.",
  },
  {
    name: "Unit Composition and Wargear Options",
    ruleRef: "02.06 / 02.07",
    aliases: ["unit composition", "wargear options", "wargear option", "swapping weapons", "default wargear"],
    summary:
      "Unit composition gives the number and type of models and each model's default wargear, and may add rules such as which units a leader can join or what can ride in a TRANSPORT. Wargear options are the swaps you may make when adding the unit to your army.",
  },

  // === 03 Moving ===
  {
    name: "Moving Units",
    ruleRef: "03.01",
    aliases: ["moving", "move", "movement rules", "how does moving work", "rotating", "rotate", "pivot", "pivoting", "moving a model", "move through models", "moving through models", "ending a move", "move types", "illegal move"],
    summary:
      "Move models one at a time in any number of straight lines and rotations; straight-line distance adds up to the move's limit, and rotating around the base's centre is free. Models can pass through friendly models and any gap their base fits through, but bases can't cross enemy models or the battlefield edge. When finished, the unit must be in coherency, with no model on another model or partway through a terrain surface, and any 'After Moving' conditions met. If not, the whole move is undone.",
  },
  {
    name: "Selecting Modes",
    ruleRef: "09.02.02",
    aliases: ["modes", "mode", "selecting a mode", "move modes"],
    summary:
      "Some moves make you pick a mode. You can only pick one, and you check them in the listed order. If the unit meets none, it can't make that move. A move's conditions labelled with a mode only apply if you picked that mode, and unlabelled ones always apply.",
  },
  {
    name: "Set Up",
    ruleRef: "03.02",
    aliases: ["setting up", "setting up a unit", "set up a unit", "setup", "can't set up", "cannot set up a unit", "no room to set up"],
    summary:
      "When a rule tells you to set up a unit, place it in coherency, unengaged and following any other restrictions. If you can't fit all of its models, it goes back where it was (reserves or inside a TRANSPORT). If this happened during a move type, it counts as not having been selected for that move, so it can try again or remain stationary later.",
  },
  {
    name: "Coherency",
    ruleRef: "03.03",
    aliases: ["unit coherency", "coherence", "regaining coherency", "out of coherency", "losing coherency", "how far apart can models be"],
    summary:
      "Every model must be within 2\" horizontally and 5\" vertically of at least one other model in its unit, and within 9\" horizontally and 5\" vertically of every other model in it. Units must be set up and end all moves this way. In the End of Turn step of each player's turn, a unit out of coherency removes models one at a time until it's back in; those models are destroyed but don't trigger rules for being destroyed.",
  },
  {
    name: "Engagement",
    ruleRef: "03.04",
    aliases: ["engagement range", "engaged", "unengaged", "in engagement", "within engagement range", "melee range", "combat range"],
    summary:
      "Engagement range is 2\" horizontally and 5\" vertically. A model with an enemy model inside that range is engaged with it, and so are both of their units. A unit with no engaged models is unengaged.",
  },

  // === 04 Making attacks ===
  {
    name: "Making Attacks",
    ruleRef: "04",
    aliases: ["how do attacks work", "shooting and fighting steps", "resolve attacks", "resolving attacks", "gather attack dice", "attack dice", "models with no ranged weapons", "models with no melee weapons"],
    summary:
      "Pick weapons, pick targets, then resolve. Pick one enemy unit, gather the dice for one weapon aimed at it plus any weapons making identical attacks, run the attack sequence, then repeat until all weapons on that unit and any others have been used. A model with no ranged weapons can't make ranged attacks, and one with no melee weapons can't make melee attacks.",
  },
  {
    name: "Selecting Weapons",
    ruleRef: "04.01",
    aliases: ["select weapons", "choosing weapons", "which weapons can i use", "how many melee weapons"],
    summary:
      "For each model, choose what it attacks with. When shooting it can use one or more of its ranged weapons, subject to [CLOSE-QUARTERS] limits (24.07). When fighting it must use one melee weapon, plus any [EXTRA ATTACKS] weapons (24.11). A weapon with several profiles picks one, per model, in this step.",
  },
  {
    name: "Selecting Targets",
    ruleRef: "04.02",
    aliases: ["select targets", "targeting", "choosing targets", "split fire", "splitting fire", "target eligibility", "who can i shoot"],
    summary:
      "Each weapon can pick its own target. When shooting, a target must normally be an unengaged enemy unit that's visible to that model and in that weapon's range. When fighting, each target must be engaged with that model, and a weapon can't pick more targets than its A. A ranged weapon with no target, or that you choose not to aim, simply makes no attacks.",
  },
  {
    name: "Identical Attacks",
    ruleRef: "04.03.01",
    aliases: ["identical weapons", "fast dice", "fast rolling", "rolling attacks together"],
    summary:
      "Attacks are identical if they share the same BS/WS, S, AP and D and the same abilities and rules apply to them. Identical attacks at the same target are gathered and rolled together, even if they come from different weapons.",
  },
  {
    name: "Splitting Melee Attacks",
    ruleRef: "04.03.02",
    aliases: ["split melee attacks", "splitting attacks", "split attacks", "melee against two units", "fighting multiple units"],
    summary:
      "If a melee weapon targets several units, say how many of its attacks go at each when choosing targets, with at least one per unit. Then gather only that many dice for that weapon against each target.",
  },

  // === 05 Attack sequence ===
  {
    name: "Attack Sequence",
    ruleRef: "05",
    aliases: ["attack steps", "how do attacks resolve", "combat sequence", "rolling to hit and wound", "order of attack rolls"],
    summary:
      "Four steps: hit rolls, wound rolls, save rolls, then inflict damage. Roll all dice for a step at the same time. An attack finishes as soon as it fails or inflicts damage.",
  },
  {
    name: "Hit Rolls",
    ruleRef: "05.01",
    aliases: ["hit roll", "rolling to hit", "roll to hit", "to hit", "how do i hit"],
    summary:
      "Roll one D6 per attack die. An unmodified 1 always fails and an unmodified 6 is a critical hit. Otherwise you hit if the result equals or beats the attack's BS or WS.",
  },
  {
    name: "Wound Rolls",
    ruleRef: "05.02",
    aliases: ["wound roll", "rolling to wound", "roll to wound", "to wound", "wound chart", "wound table", "strength vs toughness", "strength versus toughness"],
    summary:
      "Roll one D6 per hit and compare the attack's Strength to the target's Toughness. S at least double T needs 2+; S above T needs 3+; equal needs 4+; S below T needs 5+; S half T or less needs 6+. An unmodified 1 always fails and an unmodified 6 is a critical wound.",
  },
  {
    name: "Critical Hits and Critical Wounds",
    ruleRef: "05.01.01",
    aliases: ["critical hit", "critical wound", "critical hits", "critical wounds", "crit", "crits", "natural six", "unmodified six"],
    summary:
      "An unmodified 6 to hit is a critical hit, and an unmodified 6 to wound is a critical wound. They still count as a hit or a wound, and they can also trigger abilities such as [LETHAL HITS] and [DEVASTATING WOUNDS]. [ANTI] weapons can make lower wound rolls critical.",
  },
  {
    name: "Save Rolls",
    ruleRef: "05.03",
    aliases: ["save roll", "save", "saves", "saving throw", "armour save", "armor save", "allocating wounds", "wound allocation", "allocate wounds", "allocating attacks", "allocation", "allocation group", "allocation groups", "allocation order", "current allocation group"],
    summary:
      "The defender splits the unit into groups: one per CHARACTER model, and one for all other models sharing the same W, Sv and InSv. They set the order, except a non-CHARACTER group with a wounded model goes first, CHARACTER groups come after all others, and wounded CHARACTER groups come before unwounded ones. They then roll one D6 for each attack that wounded. Attacks are allocated to the first group until it's gone, then to the next.",
  },
  {
    name: "Inflict Damage",
    ruleRef: "05.04",
    aliases: ["inflicting damage", "resolving damage", "taking damage", "losing wounds", "checking saves", "how does ap work", "invulnerable save or armour save", "excess damage", "spillover damage"],
    summary:
      "Work through save rolls from lowest to highest, picking a model in the current group (a wounded one if possible). An unmodified 1 always inflicts damage; otherwise the attack fails if the roll equals or beats the group's InSv, or if the roll after applying AP equals or beats its Sv. If it inflicts damage, the model loses wounds equal to D and is destroyed at 0 or fewer. If the unit is wiped out, remaining attacks are lost.",
  },

  // === 06 Other concepts ===
  {
    name: "Visibility",
    ruleRef: "06.01",
    aliases: ["line of sight", "los", "visible", "fully visible", "not visible", "can i see", "true line of sight", "seeing through models"],
    summary:
      "Trace an imaginary 1 mm wide straight line from any part of the observer to any part of the other model, ignoring other models in both of their units. A model is visible if any part can be seen, and fully visible if every part facing the observer can be seen. A unit is visible if at least one of its models is, and fully visible only if all of them are. Terrain adds further limits (13.07).",
  },
  {
    name: "Mortal Wounds",
    ruleRef: "06.02",
    aliases: ["mortal wound", "mortals", "mw", "mws", "how do mortal wounds work", "mortal wounds and saves"],
    summary:
      "Resolve them one at a time until they're all done or the unit is gone; each removes 1 wound with no save step. Choose the model in this order: a wounded non-CHARACTER, any non-CHARACTER, a wounded CHARACTER, any CHARACTER. If attacks cause both normal damage and mortal wounds, do the normal damage first.",
  },
  {
    name: "Hazard Rolls",
    ruleRef: "06.03",
    aliases: ["hazard roll", "hazard", "hazard test", "hazard check", "failed hazard"],
    summary:
      "Roll one D6. On a 1 or 2 it fails and the unit suffers 1 mortal wound, or 3 mortal wounds if every model in the unit is a MONSTER or VEHICLE. Make several hazard rolls for one unit at the same time.",
  },

  // === 07-12 The battle round and its phases ===
  {
    name: "Battle Round",
    ruleRef: "07",
    aliases: ["battle rounds", "round", "game length", "how long is a game", "end of battle round", "start of battle round"],
    summary:
      "A round has a start, one turn for each player, then an end. The same player goes first in every round, as set by the mission. A battle usually lasts five rounds, but the mission decides. At the end of a round, non-mission rules resolve first, then mission rules.",
  },
  {
    name: "Player Turn",
    ruleRef: "07.02",
    aliases: ["turn", "turns", "turn order", "turn structure", "order of a turn", "phases in a turn", "start of turn", "end of turn", "start of turn step", "end of turn step", "who goes first"],
    summary:
      "Start of Turn step, then the Command, Movement, Shooting, Charge and Fight phases in that order, then the End of Turn step. At the End of Turn step, non-mission rules resolve first, then mission rules. The mission says which player goes first.",
  },
  {
    name: "Command Phase",
    ruleRef: "08",
    aliases: ["command"],
    summary:
      "In order: start-of-phase rules, both players gain 1 CP, the active player's battle-shock rolls, other Command-phase rules, then end-of-phase rules (non-mission rules first, then mission rules).",
  },
  {
    name: "Command Points",
    ruleRef: "08.02",
    aliases: ["cp", "core cp", "gaining cp", "how much cp", "how many command points", "command point", "gain core cp"],
    summary:
      "Both players gain 1 CP in every Command phase, so in both players' turns. CP pays for stratagems. 'Core CP' is just the name for these points, and they work like any other CP.",
  },
  {
    name: "Battle-shock Step",
    ruleRef: "08.03",
    aliases: ["when do i take battle-shock", "when do i roll battle-shock", "battle-shock timing", "recovering from battle-shock", "removing battle-shock", "curing battle-shock", "half-strength battle-shock", "multiple battle-shock rolls", "battle-shock rolls in reserves"],
    summary:
      "In the Command phase, the active player rolls battle-shock for each of their units that's already battle-shocked or at or below half-strength, including units in reserves or embarked. Each unit rolls at most once in this step. A unit that started this step battle-shocked and passes is no longer battle-shocked.",
  },
  {
    name: "Movement Phase",
    ruleRef: "09",
    aliases: ["move units", "selecting units to move", "move phase"],
    summary:
      "The active player picks units one at a time, each choosing one move type it's eligible for, including units in strategic reserves or embarked. Any unit not given a move type remains stationary. Move types here are remain stationary, normal, advance, fall-back, disembark and ingress.",
  },
  {
    name: "Remain Stationary",
    ruleRef: "09.04",
    aliases: ["remained stationary", "stationary", "not moving", "staying still", "stay still"],
    summary:
      "Any unit can choose this. No model moves or rotates, and it doesn't trigger rules for starting or ending a move.",
  },
  {
    name: "Normal Move",
    ruleRef: "09.05",
    aliases: ["normal moves", "regular move", "standard move", "more than one normal move", "two normal moves"],
    summary:
      "An unengaged unit on the battlefield can move up to its M characteristic, and it must finish unengaged. A unit can't make more than one normal move in a phase.",
  },
  {
    name: "Advance Move",
    ruleRef: "09.06",
    aliases: ["advance", "advancing", "advance roll", "advanced", "advance moves", "can i shoot after advancing", "can i charge after advancing"],
    summary:
      "An unengaged unit on the battlefield rolls one D6 before moving, then can move up to M plus that roll, finishing unengaged. For the rest of the turn it normally can't declare a charge or start an action. It can only shoot using assault shooting (10.05).",
  },
  {
    name: "Fall-back Move",
    ruleRef: "09.07",
    aliases: ["fall back", "falling back", "fall-back", "fell back", "ordered retreat", "desperate escape", "retreat", "leave combat", "leaving combat", "can i shoot after falling back", "desperate escape test"],
    summary:
      "An engaged unit can move up to its M and must finish unengaged; for the rest of the turn it normally can't shoot, declare a charge or start an action. Choose a mode first. Ordered Retreat costs nothing extra but isn't available to a battle-shocked unit. Desperate Escape is forced if the unit is battle-shocked and optional otherwise: make a hazard roll per model, its models can move through enemy models, and afterwards a unit not already battle-shocked must take a battle-shock roll.",
  },
  {
    name: "Shooting Phase",
    ruleRef: "10",
    aliases: ["shooting", "shoot", "shooting types", "shooting type", "selecting units to shoot", "eligible to shoot"],
    summary:
      "The active player picks units one at a time. A unit on the battlefield that hasn't shot this phase is eligible, and picks one shooting type it qualifies for: normal, assault, close-quarters or indirect. Units don't have to shoot.",
  },
  {
    name: "Normal Shooting",
    ruleRef: "10.04",
    aliases: ["normal shoot", "regular shooting"],
    summary:
      "For an unengaged unit that didn't advance this turn. It shoots as usual, then can't start an action this phase.",
  },
  {
    name: "Assault Shooting",
    ruleRef: "10.05",
    aliases: ["shooting after advancing", "shoot after advancing", "assault shoot"],
    summary:
      "For an unengaged unit that advanced this turn and has at least one [ASSAULT] weapon. Only [ASSAULT] weapons can attack, and the unit then can't start an action this phase.",
  },
  {
    name: "Close-quarters Shooting",
    ruleRef: "10.06",
    aliases: ["close quarters shooting", "shooting while engaged", "shooting in melee", "shoot in combat", "shooting in combat", "monster shooting in combat", "vehicle shooting in combat", "big guns never tire"],
    summary:
      "For an engaged unit that didn't advance and has a [CLOSE-QUARTERS] weapon or is a MONSTER or VEHICLE. Other models may only use [CLOSE-QUARTERS] weapons at units they're engaged with. MONSTER and VEHICLE models aren't limited that way and can also shoot units they're engaged with, at -1 to hit unless it's a [CLOSE-QUARTERS] weapon aimed at a unit they're engaged with; their [BLAST] weapons still can't target a unit they're engaged with. The unit then can't start an action this phase.",
  },
  {
    name: "Indirect Shooting",
    ruleRef: "10.07",
    aliases: ["indirect", "firing without line of sight", "shooting without line of sight"],
    summary:
      "For an unengaged unit that didn't advance and has an [INDIRECT FIRE] weapon. Those weapons can target unseen units, but the target has the benefit of cover, you can't re-roll hit rolls, and unmodified hit rolls of 1-5 fail (only 1-3 if the unit remained stationary and a friendly unit can see the target). Its other weapons still need visible targets. The unit then can't start an action this phase.",
  },
  {
    name: "Charge Phase",
    ruleRef: "11",
    aliases: ["charge phase steps"],
    summary:
      "The active player resolves charges one unit at a time: declare, roll 2D6, then attempt the charge move if it's possible and you still want to. Start- and end-of-phase rules resolve either side of this.",
  },
  {
    name: "Declaring a Charge",
    ruleRef: "11.02",
    aliases: ["declare a charge", "declare charge", "charge roll", "charge rolls", "failed charge", "failed charges", "who can charge", "can i charge", "eligible to charge", "eligible to declare a charge", "charge eligibility", "charge distance", "how far can i charge"],
    summary:
      "A unit on the battlefield can declare a charge unless it's more than 12\" from all enemy units, is engaged, or advanced or fell back this turn. Roll 2D6 for the maximum distance. If the charge isn't possible, or you decide against it, the unit doesn't move and the charge is over. A roll of 2 can't succeed without a modifier, because a charging unit starts outside the 2\" engagement range.",
  },
  {
    name: "Charge Move",
    ruleRef: "11.04",
    aliases: ["charge", "charging", "charges", "charge moves", "charge targets", "charge target", "how does charging work", "must end in base contact"],
    summary:
      "Pick one or more enemy units within 12\" and within your charge roll as charge targets. Each model must finish closer to a target, within 1\" of one if it can and engaged with one if it can. Afterwards the unit must be engaged with every target and with no other enemy unit, or the move fails. Models that charge gain Fights First until the end of the turn.",
  },
  {
    name: "Fight Phase",
    ruleRef: "12",
    aliases: ["fight", "fighting", "melee", "combat", "close combat", "fight phase steps", "do units have to fight"],
    summary:
      "In order: start-of-phase rules, pile in, fight, consolidate, end-of-phase rules. Both players' units take part, and the player whose turn it is moves first in each moving step. Every unit that can fight must fight, but piling in and consolidating are optional.",
  },
  {
    name: "Pile-in Move",
    ruleRef: "12.03",
    aliases: ["pile in", "piling in", "pile-in", "pile in move", "pile in moves"],
    summary:
      "Up to 3\", for a unit that's engaged, charged this turn or was selected for an overrun fight. Targets are every enemy unit it's engaged with; if it isn't engaged, choose one or more enemy units within 5\". Models in base contact with an enemy stay put, and each model that moves must end closer to the closest target and engaged with it if possible. The unit must end engaged, and models that began engaged with a unit must stay engaged with it.",
  },
  {
    name: "Fight Order",
    ruleRef: "12.04",
    aliases: ["fight sequence", "fight step", "who fights next", "alternating fights", "alternate fighting", "selecting units to fight", "order of fighting", "eligible to fight"],
    summary:
      "A unit can fight if it hasn't yet this phase and it's engaged, was engaged at the start of this step, or charged this turn. Starting with the player whose turn it is, players alternate picking Fights First units until none are left, then alternate picking the rest, starting with the player who moved the sequence on. If a Fights First unit becomes eligible later, go back to those first. If a player has no eligible unit to pick, their opponent picks.",
  },
  {
    name: "Normal Fight",
    ruleRef: "12.05",
    aliases: ["normal fights", "regular fight"],
    summary:
      "An engaged unit selected to fight simply makes its melee attacks.",
  },
  {
    name: "Overrun Fight",
    ruleRef: "12.06",
    aliases: ["overrun", "overrun fights", "overrunning", "fighting when not engaged", "unengaged fight"],
    summary:
      "For a unit selected to fight that's unengaged, or that was unengaged at the start of the Fight step and became engaged during the phase. It can make one extra pile-in move, then attacks. Enemies it newly engages become eligible to fight. It must still be eligible to fight to be selected at all: a unit that got engaged and then disengaged during the step can't do this.",
  },
  {
    name: "Consolidation Move",
    ruleRef: "12.08",
    aliases: ["consolidate", "consolidating", "consolidation", "consolidation moves", "ongoing consolidation", "engaging consolidation", "objective consolidation"],
    summary:
      "Up to 3\", after fighting, for a unit that was eligible to fight this phase; the first mode that fits is forced, and if none fits there's no move. Ongoing: if engaged, move towards the closest engaged enemy, and base-contact models stay put and engaged models stay engaged. Engaging: otherwise, if within 3\" of an enemy, end engaged with every enemy unit you chose, and any enemy unit that hasn't fought yet must then be picked to fight. Objective: otherwise, if within 3\" of an objective, end in range of it and unengaged.",
  },

  // === 13 Terrain ===
  {
    name: "Terrain Areas",
    ruleRef: "13.01",
    aliases: ["terrain area", "placing terrain", "terrain placement", "terrain setup", "setting up terrain", "terrain", "terrain rules"],
    summary:
      "A terrain area is the space inside a defined boundary, such as a base or mat with features on it, a single feature, or an area marked out by several features together. A mission map may fix each area, or players agree them before the battle.",
  },
  {
    name: "Terrain Categories",
    ruleRef: "13.02",
    aliases: ["terrain category", "terrain types", "types of terrain", "terrain keywords", "ruins"],
    summary:
      "Each feature is exposed (craters, razorwire, debris), light (barricades, low walls, statues) or dense (buildings, ruins, containers, woods). One terrain area can mix them. The category decides how models move through it and what it does to visibility.",
  },
  {
    name: "Exposed Terrain",
    ruleRef: "13.03",
    aliases: ["exposed", "craters", "razorwire", "debris"],
    summary:
      "Craters, razorwire and scattered debris. All models can move through it freely, horizontally and vertically, and an area containing only exposed features doesn't obscure.",
  },
  {
    name: "Light Terrain",
    ruleRef: "13.04",
    aliases: ["light", "barricades", "low walls", "statues"],
    summary:
      "Barricades, low walls and statues. All models can move through it freely, horizontally and vertically, and an area containing a light feature is an obscuring terrain area (13.10).",
  },
  {
    name: "Dense Terrain",
    ruleRef: "13.05",
    aliases: ["dense", "buildings", "woods", "containers", "moving through ruins"],
    summary:
      "Buildings, ruins, armoured containers and woods. It has the Solid rule, makes its terrain area obscuring, can hide infantry, and limits who can move through it (13.06).",
  },
  // The PDF is unclear here: 13.06 says non-INFANTRY/BEASTS/SWARM models climbing dense
  // terrain can't end above ground level, yet its next paragraph lets MONSTER and FLY
  // models end on upper surfaces. Both are stated below, without reconciling them.
  {
    name: "Terrain and Movement",
    ruleRef: "13.06",
    aliases: ["moving through terrain", "move through walls", "moving through walls", "can vehicles move through terrain", "mobile keyword", "mobile"],
    summary:
      "Everything can pass through exposed and light terrain. Through dense terrain, INFANTRY, BEASTS, SWARM and MOBILE can move horizontally, but only the first three can move vertically. Anything else moves horizontally only through sections 2\" tall or less; taller sections must be climbed, with no passing through floors or ceilings and no ending on a surface above ground level.",
  },
  {
    name: "Moving Vertically",
    ruleRef: "13.06",
    aliases: ["climbing", "climb", "vertical movement", "moving up terrain", "going upstairs", "ending on terrain", "ending a move on terrain", "upper floors", "standing on terrain", "overhang", "base overhang"],
    summary:
      "A model climbing must stay within 1/2\" horizontally of the feature, and the distance both up and down counts against its move. Any model can end on ground level. Above ground level it needs INFANTRY, BEASTS, SWARM, FLY or MONSTER, must be stable, and can't have its base overhanging the edge. Other models climbing dense terrain can't end above ground level.",
  },
  {
    name: "Terrain and Visibility",
    ruleRef: "13.07",
    aliases: ["terrain visibility", "terrain line of sight", "seeing through terrain"],
    summary:
      "Terrain affects visibility through four rules: Benefit of Cover (13.08), Hidden (13.09), Obscuring (13.10) and Solid (13.11).",
  },
  {
    name: "Benefit of Cover",
    ruleRef: "13.08",
    aliases: ["cover", "in cover", "having cover", "does cover give a save", "cover bonus", "benefit of cover save"],
    summary:
      "It applies to a ranged attack only, and only if every model in the target unit qualifies: an INFANTRY, BEASTS or SWARM model inside a terrain area, or any model that intervening terrain or an obscuring area stops from being fully visible to the attacker. The effect is to worsen that attack's BS by 1. It doesn't change the save.",
  },
  {
    name: "Hidden",
    ruleRef: "13.09",
    aliases: ["hiding", "hide", "detection range", "detection", "concealed"],
    summary:
      "An INFANTRY, BEASTS or SWARM model is hidden while in a terrain area with a light or dense feature, if its unit made no ranged attacks this turn or last turn. In the first turn, nobody counts as having shot in the previous turn. Enemy models can only see a hidden model from within its detection range, normally 15\".",
  },
  {
    name: "Obscuring",
    ruleRef: "13.10",
    aliases: ["obscuring terrain", "obscured", "obscuring terrain area", "obscures"],
    summary:
      "Any terrain area with a light or dense feature is obscuring. Two models can't see each other if every line of sight between them crosses such an area, not counting an area either of them is inside.",
  },
  {
    name: "Solid",
    ruleRef: "13.11",
    aliases: ["solid terrain", "windows", "doors", "shooting through windows", "seeing through windows", "firing through windows"],
    summary:
      "Dense features have this. You can't draw line of sight through an enclosed gap, such as a door or window, that's 3\" or less above ground level, though higher gaps work normally. Also, no part of a model can end a move poking through such an enclosed part.",
  },

  // === 14 Objectives ===
  {
    name: "Terrain Objectives",
    ruleRef: "14.01",
    aliases: ["objective", "objectives", "terrain objective", "where are objectives", "objective range", "within range of an objective", "range of an objective"],
    summary:
      "If a mission's objective point falls on a terrain area, that whole area is the objective. A model is in range while it's within that terrain area, and distances are measured to its closest part. For a point not on a terrain area, see Objective Markers.",
  },
  {
    name: "Controlling Objectives",
    ruleRef: "14.02",
    aliases: ["level of control", "objective control rules", "controlling an objective", "control an objective", "who controls an objective", "holding objectives", "capturing objectives", "contested objective", "when do i check objectives"],
    summary:
      "At the end of every phase and turn, before any other end-of-phase or end-of-turn rules, each player adds up the OC of their models in range, and the higher total controls it. On a tie nobody controls it, unless it's secured. Nobody controls anything at the start of the battle, and a model needs OC 1 or more to gain control.",
  },
  {
    name: "Secured Objectives",
    ruleRef: "14.03",
    aliases: ["secured", "secure an objective", "securing objectives", "secured objective", "sticky objectives", "sticky objective"],
    summary:
      "Certain rules let your army secure an objective. It stays yours even with no units nearby, until your opponent's level of control over it beats yours at the end of a phase.",
  },
  {
    name: "Objective Markers",
    ruleRef: "14.01.01",
    aliases: ["objective marker", "objectives not in terrain", "objective not within a terrain area", "40mm objective", "objective token"],
    summary:
      "If an objective's point isn't on a terrain area, mark it with a flat 40 mm circular marker centred on the point. Models can move over it and stand on it. A model is in range while within 3\" horizontally and 5\" vertically of it, measuring to its closest part.",
  },

  // === 15 Stratagems ===
  {
    name: "Using Stratagems",
    ruleRef: "15.01",
    aliases: ["stratagem", "stratagems", "stratagem rules", "stratagem limits", "how do stratagems work", "same stratagem twice", "two stratagems on one unit", "stratagem restrictions"],
    summary:
      "Pick targets, pay the CP, then apply the effect; if you can't afford it you can't use it, and extra-cost sections (like +1CP) need the extra paid. You can't use the same stratagem twice in one phase, and you normally can't target one unit with two stratagems in one phase. Battle-shocked units can't be targeted by their own controller's stratagems.",
  },
  {
    name: "Core Stratagems",
    ruleRef: "15.02-15.12",
    aliases: ["core stratagem", "list of core stratagems", "universal stratagems"],
    summary:
      "All players can use these: Command Re-roll (15.02), Epic Challenge (15.03), Insane Bravery (15.04), Explosives (15.05), Crushing Impact (15.06), Rapid Ingress (15.07), Fire Overwatch (15.08), Smokescreen (15.10), Heroic Intervention (15.11) and Counteroffensive (15.12). Counteroffensive costs 2CP and the others 1CP. Heroic Intervention's Into the Fray mode costs +1CP.",
  },
  {
    name: "Snap Shooting",
    ruleRef: "15.09",
    aliases: ["snap shots", "snap shot", "overwatch shooting", "overwatch hits"],
    summary:
      "The shooting type used by Fire Overwatch. Pick one visible, eligible enemy unit within 24\". Only an unmodified 6 hits, whatever the BS or modifiers, and hit rolls can't be re-rolled. The unit then can't start an action this phase.",
  },

  // === 16 Actions ===
  {
    name: "Actions",
    ruleRef: "16.01",
    aliases: ["action", "performing actions", "performing an action", "starting an action", "completing an action", "start an action", "who can do actions", "core actions", "action rules"],
    summary:
      "A unit can't start an action if it's off the battlefield, is an AIRCRAFT or FORTIFICATION, is battle-shocked, has OC 0 or '-', is engaged (unless TITANIC), advanced or fell back this turn, or already started one this turn. After starting, it can't shoot (unless TITANIC) or declare a charge this turn. It fails to complete if it moves, except for pile-in and consolidation moves, or leaves the battlefield. Each action's own card gives its timing, eligible units, use limit and effect, and those are found in mission packs and other publications.",
  },

  // === 17 Monsters and vehicles ===
  {
    name: "Moving Monsters and Vehicles",
    ruleRef: "17.01",
    aliases: ["monsters and vehicles", "vehicles moving through models", "monster moving through models", "can a tank move through infantry", "vehicle movement", "moving over infantry"],
    summary:
      "During a normal or advance move, MONSTER and VEHICLE models can pass through friendly and enemy models, except other MONSTER or VEHICLE models.",
  },
  {
    name: "Frame",
    ruleRef: "17.02",
    aliases: ["frame keyword", "models without a base", "no base", "measuring vehicles", "hull", "measuring from the hull", "baseless"],
    summary:
      "FRAME is a keyword mostly on models with no base. Unless a rule says otherwise, measure to and from the closest point of the model itself, not its base if it has one. A FRAME model with no base rotates around its central axis and stays upright.",
  },
  {
    name: "Shooting at Engaged Monsters and Vehicles",
    ruleRef: "17.03",
    aliases: ["shooting engaged monsters", "shooting engaged vehicles", "shooting at engaged vehicles", "shooting at a vehicle in combat", "shooting into combat", "shooting into melee", "shoot into combat", "blast weapons in combat", "blast at engaged units", "blast while engaged", "blast against engaged vehicle", "blast against an engaged monster", "blast into combat"],
    summary:
      "In your Shooting phase you can target engaged enemy MONSTER and VEHICLE units, at -1 to hit, unless it's a [CLOSE-QUARTERS] weapon from a unit engaged with that target. A unit that's itself engaged with them still needs a way of shooting while engaged, such as close-quarters shooting. [BLAST] weapons still can't target an engaged unit.",
  },

  // === 18 Transports ===
  {
    name: "Transport Capacity",
    ruleRef: "18.01",
    aliases: ["transports", "transport", "starting embarked", "start in a transport", "how many fit in a transport", "riding in a transport", "dedicated transport", "dedicated transports", "empty dedicated transport"],
    summary:
      "A TRANSPORT's datasheet says what kinds of models it can carry and how many. It can hold more than one unit if there's room. Units can start embarked if declared in the Declare Battle Formations step and the whole unit fits. A DEDICATED TRANSPORT must have a unit embarked by the end of that step, or it's destroyed without triggering any destroyed rules.",
  },
  {
    name: "Embarking",
    ruleRef: "18.02",
    aliases: ["embark", "embarked", "get in a transport", "getting in a transport", "get into a transport", "boarding a transport", "enter a transport"],
    summary:
      "After a normal, advance or fall-back move, from the first battle round on, a unit can embark if every model is within 3\" of the friendly TRANSPORT, it wasn't set up this turn, it's allowed on that datasheet and there's enough capacity. It's removed from the battlefield and is now inside.",
  },
  {
    name: "Disembarking",
    ruleRef: "18.03",
    aliases: ["disembarkation", "get out of a transport", "getting out of a transport", "leave a transport", "leaving a transport", "exit a transport", "out of a transport", "how do i get out of a transport"],
    summary:
      "In your Movement phase, an embarked unit can get out by making a disembark move (18.04), if it didn't embark this phase and the TRANSPORT, on the battlefield, hasn't advanced or fallen back this phase. If the TRANSPORT stayed still or hasn't moved yet, the unit sets up within 3\" and can then make a normal or advance move, or if it can't fit it uses the riskier combat disembark (6\", hazard rolls, battle-shocked). After the TRANSPORT's normal or ingress move, it sets up within 3\" and can't charge. If the TRANSPORT is destroyed, each unit inside must make an emergency disembark move instead (18.05); some rules grant assault or shock disembark moves (18.06, 18.07).",
  },
  {
    name: "Disembark Move",
    ruleRef: "18.04",
    aliases: ["disembark", "disembark moves", "rapid disembark", "tactical disembark", "combat disembark", "disembark distance", "how far do you disembark", "can i charge after disembarking", "disembark after the transport moves"],
    summary:
      "Set up wholly within the distance of the TRANSPORT; the mode is forced in order. Rapid (3\"): the TRANSPORT made a normal or ingress move this phase; the unit can't charge this turn, and after an ingress move it follows the same placement rules the TRANSPORT did. Tactical (3\"): the TRANSPORT stayed still or hasn't moved yet and you can set up; the unit then makes a normal or advance move. Combat (6\"): otherwise; make a hazard roll per model, the unit can set up engaged with enemies the TRANSPORT is engaged with, and it becomes battle-shocked and can't charge this turn.",
  },
  {
    name: "Emergency Disembark Move",
    ruleRef: "18.05",
    aliases: ["emergency disembark", "emergency disembarkation", "emergency disembarking", "transport destroyed", "destroyed transport", "transport dies", "when a transport is destroyed", "what happens when a transport is destroyed", "transport blows up", "transport explodes", "passengers when a transport dies"],
    summary:
      "When a TRANSPORT is destroyed, before it's removed, each unit inside must do this, and Deadly Demise is rolled afterwards. Make a hazard roll for each model, then set up each survivor wholly within 6\" of the TRANSPORT and as close to it as possible. A model that can't be placed that way while unengaged is placed engaged instead, and only a model that still can't be placed is destroyed. The unit is then battle-shocked and can't declare a charge this turn.",
  },

  {
    name: "Assault Disembark Move",
    ruleRef: "18.06",
    aliases: ["assault disembark", "charge after disembarking", "disembark and charge"],
    summary:
      "Used instead of a disembark move when a rule lets a unit charge after leaving a TRANSPORT that made a normal move this turn. It needs a TRANSPORT on the battlefield that hasn't advanced or fallen back this phase, and the unit can't have embarked this phase. Set up wholly within 3\" of it. This move carries none of the rapid disembark's bar on charging.",
  },
  {
    name: "Shock Disembark Move",
    ruleRef: "18.07",
    aliases: ["shock disembark", "disembark after the transport advances", "disembark from an advancing transport"],
    summary:
      "Used instead of a disembark move when a rule lets a unit leave a TRANSPORT that advanced this turn. The TRANSPORT must be on the battlefield and the unit can't have embarked this phase. Set up wholly within 3\" of it. Any model that started engaged with an enemy unit must stay engaged with it, and any enemy unit engaged with yours that hasn't been selected to fight this phase must then be selected by your opponent, one at a time, and fights.",
  },
  // === 19 Attached units ===
  {
    name: "Attached Units",
    ruleRef: "19.01",
    aliases: ["attached unit", "attaching", "attach", "attach a leader", "attaching a leader", "forming attached units", "bodyguard", "bodyguard unit", "bodyguard units", "joining a unit", "leader and support", "leader unit", "can a unit have two leaders"],
    summary:
      "Leader and support units can join a bodyguard unit before the battle, in the Muster Armies step, forming a single unit for all rules purposes. The datasheet lists which bodyguards each can lead. Unless a rule says otherwise, a bodyguard unit takes at most one leader unit and one support unit. Every support unit in your roster must be attached.",
  },
  {
    name: "Attacking Attached Units",
    ruleRef: "19.02",
    aliases: ["toughness of attached units", "attached unit toughness", "toughness in an attached unit", "shooting a character in a unit", "destroying an attached unit", "shooting attached units"],
    summary:
      "While any bodyguard model remains, attacks use the highest T among bodyguard models, even if a leader differs. If only leader or support models remain, use their highest T. Rules triggered by destroying a unit only trigger when the last model that started the battle in that attached unit dies.",
  },
  {
    name: "Keywords in Attached Units",
    ruleRef: "19.03",
    aliases: ["attached unit keywords", "attached keywords", "does the unit gain the leader's keywords"],
    summary:
      "The attached unit has every keyword of its parts, so rules that care about any of them apply to the whole unit, but individual models don't pick up keywords they don't have. For example, an [ANTI-PSYKER] weapon gets its bonus against a unit led by a PSYKER, even when the attack lands on a non-PSYKER model.",
  },
  {
    name: "Abilities in Attached Units",
    ruleRef: "19.04",
    aliases: ["attached unit abilities", "leader dies", "when the leader dies", "leader destroyed", "losing a leader", "bodyguard destroyed", "leader abilities after death"],
    summary:
      "A rule on one specific model (an enhancement or wargear) only affects that model. Otherwise an ability covers the whole attached unit until its source is gone: the last model of the leader, support or bodyguard unit, or the specific model carrying it. If an attack destroyed that model, the ability lasts until the attacker's attacks finish. A leader keeps its 'while leading' abilities after its bodyguard is gone, if it started the battle attached, and revived models restore the ability.",
  },

  // === 20 Strategic reserves ===
  {
    name: "Strategic Reserves",
    ruleRef: "20.01",
    aliases: ["reserves", "strategic reserve", "placing units in reserves", "reserves limit", "how many points in reserves", "putting units in reserves", "off the table"],
    summary:
      "In the Declare Battle Formations step, you can put friendly units other than FORTIFICATIONS in strategic reserves instead of deploying them. Unless a rule says otherwise, their combined points, including units inside a reserved TRANSPORT, can't exceed 50% of your points limit for the battle size.",
  },
  {
    name: "Repositioned Units",
    ruleRef: "20.02",
    aliases: ["repositioned unit", "repositioning", "reposition", "putting a unit back in reserves", "removed from the battlefield"],
    summary:
      "These are units a rule moves from the battlefield into strategic reserves mid-battle. In the Movement phase this can be used on a unit that has already moved, and a unit set up in the turn it advanced, fell back or disembarked still counts as having done so. Effects with a set duration or condition continue while off the battlefield: a battle-shocked unit stays that way, but an aura stops if it's no longer in range.",
  },
  {
    name: "Arriving from Strategic Reserves",
    ruleRef: "20.03",
    aliases: ["arriving from reserves", "reserves arrival", "when can reserves arrive", "when do reserves arrive", "reinforcements", "reserves destroyed", "failing to arrive", "reserves not arrived"],
    summary:
      "Units arrive by making an ingress move, normally from the second battle round on. Any reserve unit that still hasn't made an ingress move by the end of the third battle round is normally destroyed. The exceptions are repositioned units and units inside a TRANSPORT that has made one.",
  },
  {
    name: "Ingress Move",
    ruleRef: "20.04",
    aliases: ["ingress", "ingress moves", "ingressing", "arriving from strategic reserves distance", "reserves distance", "how far from the enemy do reserves arrive"],
    summary:
      "Set the unit up wholly within 6\" of a battlefield edge and more than 8\" horizontally from every enemy unit. Before the third battle round, no model can be in your opponent's deployment zone. Until the next Charge phase starts, the unit normally can't make any other kind of move. Units inside a TRANSPORT in reserves can't do this themselves.",
  },

  // === 21 Flying and surging ===
  {
    name: "Surge Move",
    ruleRef: "21.02",
    aliases: ["surge", "surges", "surge moves", "surging"],
    summary:
      "Only when a rule grants one, for a unit that's not battle-shocked, is unengaged and hasn't moved this phase; the rule sets the distance. The closest enemy unit is the target. Each model must end engaged with it if possible, or otherwise as close as it can. The unit can't end engaged with any other enemy unit and can't move again this phase.",
  },
  {
    name: "Flying",
    ruleRef: "21.03",
    aliases: ["fly", "flying models", "flying units", "fly keyword", "take to the skies", "taking to the skies", "can flyers move over terrain", "moving over enemies"],
    summary:
      "Before a FLY unit's normal, advance, fall-back or charge move, you can declare it's taking to the skies. Its maximum distance drops by 2\", and each FLY model ignores vertical distance and can pass through all models and all terrain categories, horizontally and vertically.",
  },

  // === 22 Other rules and abilities ===
  {
    name: "Aura Abilities",
    ruleRef: "22.01",
    aliases: ["aura", "auras", "aura ability", "aura stacking", "do auras stack"],
    summary:
      "Abilities tagged 'Aura' affect things within a stated range. A model on the battlefield is always in range of its own aura. A unit can be under several different auras, but the same aura only counts once, however many times it's in range.",
  },
  {
    name: "Faction Abilities",
    ruleRef: "22.02",
    aliases: ["faction ability", "army rule", "army rules", "army-wide rule"],
    summary:
      "Also called army rules, these are listed on the datasheet in its Faction Abilities section. They normally only work if your chosen army faction matches a faction keyword on that unit's datasheet. Look up any faction ability by name to see what it does.",
  },
  {
    name: "Psychic Abilities",
    ruleRef: "22.03",
    aliases: ["psychic ability", "psychic attack", "psychic attacks", "psychic powers", "psychic power"],
    summary:
      "These are tagged 'Psychic'. Wounds a psychic ability inflicts count as being from a psychic attack, which other rules may care about. Attacks with [PSYCHIC] weapons are psychic attacks too (24.29).",
  },
  {
    name: "Wargear Abilities",
    ruleRef: "22.04",
    aliases: ["wargear ability", "bearer", "wargear"],
    summary:
      "These come from items of wargear and are listed on the datasheet. If the unit has the item, the whole unit gets it. If one model has it, that model is the bearer, and the ability lasts until the bearer is destroyed.",
  },
  {
    name: "Plunging Fire",
    ruleRef: "22.05",
    aliases: ["shooting from height", "high ground", "towering", "towering keyword", "height advantage"],
    summary:
      "A ranged attack improves its BS by 1 if the target is a visible unit with at least one model on ground level, and either the attacker is on a section of terrain at least 3\" high, or the attacker is TOWERING and the target is within 12\". It doesn't apply to attacks by or against AIRCRAFT.",
  },

  // === 23 Aircraft ===
  {
    name: "Aircraft",
    ruleRef: "23.01 / 23.02",
    aliases: ["aircraft rules", "aircraft movement", "aircraft deployment", "flyers", "flyer", "moving through aircraft", "planes", "aeroplanes"],
    summary:
      "AIRCRAFT always start in strategic reserves, and ingress is the only move they can make. At the end of your opponent's turn, yours on the battlefield go back into reserves. Any unit can move through them. Non-FLY units ignore them when picking targets or the closest enemy for pile-in, consolidation and surge moves, and being engaged only with AIRCRAFT doesn't stop a normal or advance move.",
  },
  {
    name: "Aircraft in Combat",
    ruleRef: "23.03 / 23.04",
    aliases: ["charging aircraft", "fighting aircraft", "can i charge an aircraft", "can aircraft charge", "shooting aircraft", "aircraft melee"],
    summary:
      "AIRCRAFT can't declare a charge and can only make melee attacks at FLYING units. Only FLYING units can choose them as a charge target, and only FLYING models can attack them in melee. Plunging Fire does nothing for attacks by or against them.",
  },

  // === 24 Core abilities not already in keywords.ts ===
  {
    name: "Abilities",
    ruleRef: "24.01",
    aliases: ["core abilities", "weapon abilities", "weapon ability", "core ability", "square brackets", "ability with a keyword"],
    summary:
      "Core abilities are listed on datasheets and weapon abilities appear in square brackets on weapon profiles. A weapon ability followed by keywords, such as [LETHAL HITS: VEHICLE], only works if the target has one of those keywords.",
  },
  {
    name: "Duplicated Abilities",
    ruleRef: "24.02",
    aliases: ["duplicate abilities", "ability stacking", "abilities stacking", "do abilities stack", "stacking abilities", "two feel no pains", "multiple instances of an ability"],
    summary:
      "Copies of the same core or weapon ability never add up, even with different numbers or keywords, so the controller chooses which one applies at any time (for weapons, in the Select Weapons step). [SUSTAINED HITS 1] and [SUSTAINED HITS 2], or [ANTI-VEHICLE 4+] and [ANTI-INFANTRY 2+], are duplicates. For Scouts, use the lowest number that isn't shared by every model in the unit.",
  },
  {
    name: "Cleave",
    ruleRef: "24.06",
    aliases: ["cleave x", "cleave weapons"],
    summary:
      "If all of a [CLEAVE X] weapon's attacks go at one target, add X attack dice for every five models that were in that unit when targets were selected, rounding down. A [CLEAVE 1] weapon with A3 against 16 models makes six attacks.",
  },
  {
    name: "Close-quarters",
    ruleRef: "24.07",
    aliases: ["close quarters", "close-quarters weapons", "close quarters weapons", "sidearm", "sidearms"],
    summary:
      "These let a unit use close-quarters shooting (10.06). With another shooting type, each non-MONSTER, non-VEHICLE model must pick either its [CLOSE-QUARTERS] weapons or its other ranged weapons, not both. [PISTOL] is the same ability under its older name.",
  },
  {
    name: "Extra Attacks",
    ruleRef: "24.11",
    aliases: ["extra attacks weapon", "extra attacks weapons"],
    summary:
      "When the unit fights, a model with an [EXTRA ATTACKS] weapon uses all of those weapons as well as one of its other melee weapons, if it has one. A unit doesn't need a non-[EXTRA ATTACKS] weapon to use them.",
  },
  {
    name: "Firing Deck",
    ruleRef: "24.14",
    aliases: ["firing deck x", "shooting from a transport", "shoot from a transport", "shooting out of a transport", "firing from a transport"],
    summary:
      "When a TRANSPORT with Firing Deck X is selected to shoot in your Shooting phase, pick up to X embarked models whose units haven't shot this phase, and one ranged weapon each (no [ONE SHOT] weapons). The TRANSPORT uses those weapons as its own until it finishes attacking. Units embarked in it can't shoot this turn.",
  },
  {
    name: "Hover",
    ruleRef: "24.17",
    aliases: ["hovering", "hover mode"],
    summary:
      "When this unit takes to the skies, it doesn't lose the usual 2\" of movement.",
  },
  {
    name: "Ignores Cover",
    ruleRef: "24.18",
    aliases: ["ignore cover", "ignoring cover", "ignores cover weapons"],
    summary:
      "The target can't get the benefit of cover against this attack from any source, including rules that grant it, such as Stealth.",
  },
  {
    name: "Lance",
    ruleRef: "24.21",
    aliases: ["lance weapon", "lance weapons"],
    summary:
      "Wound rolls get +1 if the attacker's unit charged this turn.",
  },
  {
    name: "One Shot",
    ruleRef: "24.26",
    aliases: ["one-shot", "one use weapon", "single use weapon", "one shot weapons"],
    summary:
      "The weapon can only be selected to attack once per battle. A model returned to its unit doesn't get a used weapon back, but a new unit added to the army has fresh ones.",
  },
  {
    name: "Psychic Weapons",
    ruleRef: "24.29",
    aliases: ["psychic", "psychic weapon"],
    summary:
      "The attacker may disregard some or all modifiers to the attack's BS or WS and its hit roll. These attacks count as psychic attacks.",
  },
  {
    name: "Scout Move",
    ruleRef: "24.32",
    aliases: ["scout moves", "scouting", "pre-game move", "pre game move", "embarking after a scout move"],
    summary:
      "In the Resolve Pre-battle Abilities step, a unit wholly within your deployment zone can move up to the X in its Scouts X\", and must finish more than 8\" horizontally from all enemy units. If every embarked model has Scouts, a DEDICATED TRANSPORT in your zone can make the move. A unit can't embark after a scout move.",
  },
  {
    name: "Support",
    ruleRef: "24.34",
    aliases: ["support unit", "support units", "support ability", "support character"],
    summary:
      "A support unit joins a bodyguard unit before the battle, in the same way as a leader, and must be attached to one. A bodyguard unit normally takes one of each (see Attached Units, 19).",
  },
  {
    name: "Super-heavy Walker",
    ruleRef: "24.35",
    aliases: ["super heavy walker", "superheavy walker"],
    summary:
      "On a normal, advance or fall-back move, these models can pass through other models (even MONSTERS and VEHICLES, but not TITANIC) and horizontally through terrain sections 4\" tall or less. Before moving, you can also give the unit MOBILE for that move, letting it cross dense terrain, but when the move ends roll a D6 and on a 1 the unit is battle-shocked.",
  },

  {
    name: "Lone Operative in Attached Units",
    ruleRef: "24.24.01",
    aliases: ["attached lone operative", "lone operative leader", "lone operative in a unit", "lone operative range"],
    summary:
      "An attached unit has Lone Operative only if all its models do, and with different ranges the highest among its models on the battlefield applies to the whole unit. A CHARACTER with it, leading a unit without it, gets it back once only models with Lone Operative are left.",
  },
  {
    name: "Multiple One Shot Weapons",
    ruleRef: "24.26.01",
    aliases: ["two one shot weapons", "hunter-killer missiles", "multiple one shot"],
    summary:
      "A model with several of the same [ONE SHOT] weapon, such as two hunter-killer missiles, can fire each of them once per battle.",
  },
  {
    name: "Precision and Devastating Wounds",
    ruleRef: "24.28.01",
    aliases: ["precision devastating wounds", "devastating wounds and precision", "precision mortal wounds"],
    summary:
      "Mortal wounds from a [PRECISION] attack with [DEVASTATING WOUNDS] go first to the CHARACTER group selected for those attacks, unless that group is already destroyed.",
  },
  {
    name: "Torrent Restrictions",
    ruleRef: "24.37.01",
    aliases: ["torrent and indirect fire", "torrent and precision", "torrent indirect", "torrent precision"],
    summary:
      "A [TORRENT] weapon can't have [INDIRECT FIRE] or [PRECISION].",
  },
  {
    name: "Damaged",
    ruleRef: "24.39",
    aliases: ["damaged x", "damaged profile", "damaged models", "damaged wounds remaining"],
    summary:
      "Written as Damaged X. While a model has X wounds or fewer left, it's damaged and its attacks are at -1 to hit.",
  },
  {
    name: "With the 'X' Ability",
    ruleRef: "24.01.01",
    aliases: ["with the ability", "rules that need a named ability"],
    summary:
      "A rule that needs a model with a named ability ignores any number after it, so Deadly Demise 1, D3 and D6 all count as Deadly Demise.",
  },
  // === Rules Appendix (no rule numbers in the PDF) ===
  {
    name: "Starting Strength and Half-strength",
    ruleRef: "01.02.01",
    aliases: ["half strength", "half-strength", "below half strength", "below half-strength", "at half strength", "starting strength", "below starting strength"],
    summary:
      "Starting strength is the model count at the start of the first battle round, attached units included. For a unit that started as one model, compare remaining wounds to W; otherwise compare remaining models to starting strength. Half is exactly half and 'below half' is less, so an odd number can never be at half-strength, only below it. A lone surviving Captain from an attached unit of 6 is below half-strength even at full wounds.",
  },
  {
    name: "Adding a New Unit",
    ruleRef: "01.02.10",
    aliases: ["new unit", "new units", "add a unit to your army", "adding units during battle", "new unit starting strength"],
    summary:
      "A unit added during a battle has its starting strength set when it's added, and counted the usual way.",
  },
  {
    name: "Destroyed",
    ruleRef: "05.04.04",
    aliases: ["destroyed models", "destroying a model", "removing casualties", "removed from play", "when is a model removed", "dead models", "when a unit is destroyed"],
    summary:
      "A unit is destroyed once all of its models are, and destroyed models and units can't normally use abilities or be selected or targeted. When a model dies, resolve rules triggered by that first, then remove it. If it died to an attack and such rules apply, normally wait until the attacking unit has finished all its attacks. 'Destroyed by you' means by an attack from your army or a rule of yours.",
  },
  {
    name: "Different Move Characteristics",
    ruleRef: "03.01.01",
    aliases: ["different m characteristics", "mixed movement", "mixed move characteristics", "models with different movement", "units with different move"],
    summary:
      "For any move whose limit uses M, each model uses its own M, so in a unit of 6\" models with one 9\" model, that one can go 9\". All other restrictions still apply.",
  },
  {
    name: "Eligible to Fight but Unable to Fight",
    ruleRef: "12.04.01",
    aliases: ["passing in the fight phase", "pass in the fight phase", "unable to fight", "all targets destroyed", "no target to fight", "pass on fighting"],
    summary:
      "When it's your pick in the Fight sequence, if all your eligible units are more than 5\" from every enemy, you may pass the pick back. The Fight step ends if both players pass in a row, or if one passes while the other has no eligible units left.",
  },
  {
    name: "Mixed Keywords in Units",
    ruleRef: "02.05.01",
    aliases: ["mixed keywords", "units with different keywords", "models with different keywords", "keyword rules", "slash keywords", "non-keyword"],
    summary:
      "If a unit's models have different keywords, the unit has them all, but each model keeps only its own. A rule on units with a keyword applies if any model has it, and a rule on models with it applies only to those models. Slashes, commas or 'or' mean any of the keywords, and adjacent keywords mean all of them.",
  },
  {
    name: "Revived",
    ruleRef: "01.02.03",
    aliases: ["revive", "reviving", "resurrect", "resurrecting", "resurrection", "returning models", "return models", "returned models", "bringing back models", "add models to a unit"],
    summary:
      "Destroyed models come back with all their starting wargear and enhancements, normally at full wounds, and can't take the unit above starting strength. Set them up in coherency with models that were on the battlefield at the start of the phase; they can be engaged only with enemies already engaged with that unit. A revived leader or support model stays part of its attached unit and must return to it if possible. For an embarked unit, a model with no transport capacity left is destroyed without triggering destroyed rules.",
  },
  {
    name: "FAQ: Eligible to Shoot with No Ranged Weapons",
    ruleRef: "June PDF FAQ",
    aliases: ["unit with no ranged weapons", "no ranged weapons", "no ranged weapons eligible to shoot", "melee unit eligible to shoot"],
    summary:
      "A unit with no ranged weapons still counts as eligible to shoot, even though it can't make ranged attacks. This can matter for other rules, such as starting an action.",
  },

  // === Rules Appendix (app numbering) ===
  {
    name: "Within and Wholly Within",
    ruleRef: "01.04.01",
    aliases: ["within", "wholly within", "wholly", "what does within mean"],
    summary:
      "Within a distance means not more than that distance. A model is within if any part of its base is, and wholly within if all of its base is (for FRAME models, all of the model). A unit is within if at least one model is, and wholly within only if every model is.",
  },
  {
    name: "Closest Model or Unit",
    ruleRef: "01.04.02",
    aliases: ["closest", "nearest", "closest unit", "closest model", "nearest enemy", "equally close"],
    summary:
      "Closest means closest to the model or unit using the rule. If there's a tie, the player controlling that model or unit picks.",
  },
  {
    name: "As Close As Possible",
    ruleRef: "01.04.03",
    aliases: ["move as close as possible"],
    summary:
      "Move into base contact if the move reaches it without breaking another restriction such as coherency, otherwise get as near as you can. A model already that close stays put but counts as having moved. Towards an objective, the aim is to end in range; a model already in range can move its full distance as long as it stays in range.",
  },
  {
    name: "Base Contact",
    ruleRef: "01.04.04",
    aliases: ["base to base contact", "base-to-base", "base contact overhang", "overhanging model"],
    summary:
      "Two models whose bases touch are in base contact. If an enemy model's overhang makes that physically impossible, they count as in contact until the end of the turn, while your move would have reached without the overhang, they're as close as possible, and any parts are within 1\".",
  },
  {
    name: "Table Quarters",
    ruleRef: "01.04.05",
    aliases: ["table quarter", "battlefield quarters"],
    summary:
      "Imaginary 1 mm lines through the battlefield's centre, lengthwise and widthwise, make four equal rectangles.",
  },
  {
    name: "Player's Rules",
    ruleRef: "01.03.01",
    aliases: ["whose rule is it", "my rules", "once per battle rules", "mission rules order"],
    summary:
      "Your rules are your army rules, detachments, stratagems you use, your enhancements and your units' datasheet abilities. Limits like once per battle count per player. A mission rule a player uses is theirs; one that always takes effect resolves before the active player's rules.",
  },
  {
    name: "Rules Sequencing",
    ruleRef: "01.03.02",
    aliases: ["sequencing", "which rule goes first", "rules at the same time", "order of rules", "simultaneous rules", "rule timing"],
    summary:
      "Rules at the same time go in this order: the active player's mandatory rules, then the active player's optional ones, then the opposing player's mandatory ones, then their optional ones. Each player orders their own. A rule newly triggered mid-sequence waits until all rules in that timing are done.",
  },
  {
    name: "Persisting Effects",
    ruleRef: "01.02.02",
    aliases: ["persisting rules effects", "persisting effect", "effect duration", "how long do effects last", "effects in reserves", "effects while embarked"],
    summary:
      "A rule with a duration keeps applying for that full duration, even through going into reserves or embarking; note it and carry on when the unit returns. A rule triggered in a stated period with no duration ends with that period. An effect given to a unit with no duration lasts only for that phase.",
  },
  {
    name: "Not on the Battlefield",
    ruleRef: "01.02.04",
    aliases: ["off the battlefield", "units in reserves targeted", "embarked units targeted", "can you target embarked units"],
    summary:
      "Embarked and reserve units can't see or be seen, and distances can't be measured to or from them, so nothing needing visibility or a range can pick them, apart from their own abilities. They can still use their other rules, count as part of your army for army-wide rules, and still roll for battle-shock.",
  },
  {
    name: "Splitting Units",
    ruleRef: "01.02.06",
    aliases: ["split a unit", "split units", "splitting a unit"],
    summary:
      "When a rule lets you split a unit, make two units as equal in size as possible, noting which models are in each, and models can only be split once. If split before the battle, each new unit's starting strength is its new model count.",
  },
  {
    name: "Describing Units",
    ruleRef: "01.02.07",
    aliases: ["hidden unit", "unit descriptors", "unit descriptor", "a battle-shocked unit", "descriptor"],
    summary:
      "A description such as 'hidden unit' or 'TERMINATOR unit' fits if at least one model in the unit meets it. That doesn't give the rule to every model, unless the rule says it gives it to the unit.",
  },
  {
    name: "Tokens",
    ruleRef: "01.02.09",
    aliases: ["token", "reminder tokens"],
    summary:
      "Tokens are reminders, never models for any purpose, even if a model is used as one. Move a token aside if a model needs its space.",
  },
  {
    name: "Automatically Successful Rolls",
    ruleRef: "01.05.01",
    aliases: ["automatically successful", "automatic hit", "automatic hits", "automatic wound", "automatic wounds", "auto hit", "auto wound", "auto hits", "are automatic hits critical", "auto pass"],
    summary:
      "Don't roll; go to the next step as if you'd got the needed result. Rules that depend on a roll's result don't trigger, so an automatic hit or wound is never critical.",
  },
  {
    name: "Re-rolls",
    ruleRef: "01.05.02",
    aliases: ["re-roll", "reroll", "rerolls", "rerolling", "re-rolling", "re-rolling a 2d6"],
    summary:
      "A dice can only be re-rolled once, and re-rolls come before modifiers. For a roll made by adding several dice, such as 2D6, re-roll all of them. A re-rolled dice can still trigger rules.",
  },
  {
    name: "Roll Off",
    ruleRef: "01.05.05",
    aliases: ["roll-off", "rolloff", "rolling off"],
    summary:
      "Both players roll one D6 and the higher wins. On a tie, roll again.",
  },
  {
    name: "Doubles, Triples and Highest Dice",
    ruleRef: "01.05.06 / 01.05.07",
    aliases: ["doubles", "double", "triples", "highest dice result", "lowest dice result"],
    summary:
      "A double has any two dice with the same result, and a triple any three. If several dice tie for highest or lowest, the active player picks which one it is.",
  },
  {
    name: "Treated As or Set To",
    ruleRef: "01.05.08",
    aliases: ["treated as", "set to", "dice treated as"],
    summary:
      "A dice treated as or set to a value triggers whatever that value would trigger, and it can go above what a D6 can roll.",
  },
  {
    name: "Modifiers",
    ruleRef: "02.02.01",
    aliases: ["modifier", "modifying dice rolls", "hit roll modifier", "wound roll modifier", "modifier cap", "plus one to hit cap", "minus one to hit", "how many modifiers", "order of modifiers", "unmodified", "modified characteristics", "characteristic modifiers", "modifying characteristics", "modifying damage"],
    summary:
      "All modifiers add up, applied in this order: any set value, multiply, add, divide, subtract, then round fractions up. Hit and wound rolls can't change by more than 1 either way in total, charge rolls cap at 12, and a result can't go below 1. Re-rolls come first, and 'unmodified' means the result after re-rolls but before modifiers. For characteristic limits, see Characteristic Limits.",
  },
  {
    name: "Characteristic Limits",
    ruleRef: "02.02.01",
    aliases: ["improving bs", "worsening bs", "improving a characteristic", "worsening a characteristic", "best possible save", "max leadership"],
    summary:
      "After modifiers: M, T, A, S, D and range stay at least 1 (1\" for distances), Sv and InSv no better than 2+, WS and BS between 2+ and 6+, Ld between 5+ and 8+, OC not below 0, and AP no worse than 0. Improving BS, WS, Sv or Ld lowers the number; worsening raises it. Characteristics of '-', '*' or 'N/A' can't be modified.",
  },
  {
    name: "Ignoring Modifiers",
    ruleRef: "02.02.02",
    aliases: ["ignore modifiers", "ignore modifier", "ignoring roll modifiers"],
    summary:
      "Unless limited, you can ignore modifiers to the unit's rolls, profile and weapons. You choose which, so you may keep a bonus and ignore a penalty.",
  },
  {
    name: "Limits on Other Modifiers",
    ruleRef: "02.02.01",
    aliases: ["detection range limit", "lone operative limit", "stratagem cost limit"],
    summary:
      "Detection range and Lone Operative can't go better than 9\" or worse than 30\". A stratagem can't go up by more than 1CP or below 0CP.",
  },
  {
    name: "Random Characteristics",
    ruleRef: "02.02.03",
    aliases: ["random attacks", "random damage", "random movement", "random move", "damage roll", "d6 attacks", "d6 damage", "rolling for damage"],
    summary:
      "Random M is one roll for the whole unit when it's selected to move. Random A is rolled when gathering dice, per weapon, then grouped. Random D is rolled per attack after the defender picks the model to allocate it to; this is a damage roll, and in D6+1 the +1 isn't a modifier. Anything else is rolled per model or per weapon whenever needed.",
  },
  {
    name: "Regaining Wounds",
    ruleRef: "02.02.04",
    aliases: ["healing", "heal", "heal wounds", "regain wounds", "regaining lost wounds", "full wounds remaining"],
    summary:
      "For each wound a unit regains, heal a wounded model; if none are wounded, revive a destroyed non-CHARACTER model with 1 wound. A model can't exceed its starting wounds. If the rule names a model, only that model heals and any excess is lost.",
  },
  {
    name: "Rules with Multiple Conditions",
    ruleRef: "02.03.01",
    aliases: ["multiple conditions", "rules with two conditions", "or conditions"],
    summary:
      "When an ability offers an improved effect under a second, more specific condition, both the first and the second must be met to get the better effect.",
  },
  {
    name: "Weapons with No Strength",
    ruleRef: "02.04.01",
    aliases: ["no strength", "weapon with no strength", "dash strength"],
    summary:
      "If a rule interacts with S and the weapon has none, treat it as S 1.",
  },
  {
    name: "Bearer",
    ruleRef: "02.06.01",
    aliases: ["unit's equipment", "unit equipment"],
    summary:
      "The bearer of a weapon, enhancement or wargear item is the model equipped with it. A unit's equipment is all the wargear its models have.",
  },
  {
    name: "Moving Through Models",
    ruleRef: "03.01.02",
    aliases: ["move over models", "moving over models", "moving through enemy models", "move through enemies"],
    summary:
      "A rule letting a model move over or through models lets it pass through enemy models, but every other restriction on that move still applies.",
  },
  {
    name: "Setting Up Large Models",
    ruleRef: "03.02.02",
    aliases: ["large models", "model too big", "model too large", "too big to deploy", "large model deployment", "large model reserves", "large model disembark"],
    summary:
      "If its base won't fit wholly within the deployment zone, or the distance from a battlefield edge, set it touching the edge. That turn it can't make normal, advance, fall-back or charge moves or ranged attacks (the reserves version excludes AIRCRAFT). Disembarking, if it can't be wholly within 3\", set its base within 1\" of the TRANSPORT and unengaged. Wings may overhang, but the base must still comply.",
  },
  {
    name: "Redeployments",
    ruleRef: "03.02.03",
    aliases: ["redeploy", "redeploying", "redeployment"],
    summary:
      "Remove the unit from the battlefield and deploy it again under the normal rules, including abilities such as Infiltrators.",
  },
  {
    name: "Multiple Weapon Profiles",
    ruleRef: "04.01.03",
    aliases: ["weapon profiles", "hunter profile", "hunter profiles", "two profile weapons", "frag and krak"],
    summary:
      "Pick one profile for each such weapon in the Select Weapons step; different models can pick differently. Hunter profiles are limited to targets with the stated keywords.",
  },
  {
    name: "Target No Longer Eligible",
    ruleRef: "04.03.03",
    aliases: ["target moved out of range", "target no longer eligible or viable", "target no longer viable", "new targets"],
    summary:
      "If a unit picked as a target stops being eligible, for example by moving out of range, the controlling player can pick new targets.",
  },
  {
    name: "Shot and Fought",
    ruleRef: "04.03.04 / 04.03.05",
    aliases: ["has shot", "has fought", "finished making its attacks", "selected to attack", "what counts as having shot"],
    summary:
      "A weapon, model or unit has shot, or fought, once all its attacks for that are resolved. A unit selected that makes no attacks hasn't shot or fought. A unit picked to shoot or fight is selected to attack, and has attacked once all its attacks are done.",
  },
  {
    name: "Attacks Changed by Hit and Wound Rolls",
    ruleRef: "05.03.02",
    aliases: ["attack pools", "attack pool", "re-pooling attacks", "modified attacks"],
    summary:
      "When hit or wound rolls change some attacks' profile, split them into pools of identical attacks. The active player decides which pool goes first for the save and damage steps.",
  },
  {
    name: "Suffers Damage",
    ruleRef: "05.04.03",
    aliases: ["suffered damage", "what counts as suffering damage"],
    summary:
      "A model has suffered damage once an attack allocated to it reaches the Resolve Damage step, even if a rule, such as Feel No Pain, then stops the wounds being lost.",
  },
  {
    name: "Fight on Death",
    ruleRef: "05.04.05",
    aliases: ["attack after being destroyed", "fights on death", "fight back when destroyed", "fight after death"],
    summary:
      "When a rule lets a destroyed model attack, leave it in place until its unit has attacked or the phase ends, whichever comes first. Rules triggered by its death then resolve, and it's removed.",
  },
  {
    name: "Measuring to a Destroyed Model",
    ruleRef: "05.04.06",
    aliases: ["measure to a destroyed model", "distance to a destroyed unit"],
    summary:
      "Measure to any point its base (or the model, if it has no base or is a non-WALKER VEHICLE) occupied. For a destroyed unit, use the last of its models to die.",
  },
  {
    name: "Normal Damage",
    ruleRef: "06.02.01",
    aliases: ["what is normal damage"],
    summary:
      "Damage from a weapon's D, as opposed to mortal wounds. Mortal wounds dealt alongside normal damage count as part of the same attack.",
  },
  {
    name: "Out of Phase Rules",
    ruleRef: "07.02.01",
    aliases: ["out of phase", "out-of-phase", "out of phase shooting", "overwatch and shooting abilities", "phase locked", "phase-locked"],
    summary:
      "When a unit moves, shoots, charges or fights outside the normal sequence, rules locked to a named phase can't be used with it. A unit using Fire Overwatch can't trigger 'in your Shooting phase' abilities, for example.",
  },
  {
    name: "Battle Round, Turn and Phase Wording",
    ruleRef: "07.02.02",
    aliases: ["the phase", "the turn", "your turn vs the turn", "start of the phase"],
    summary:
      "A rule triggered at the start of a round, turn or phase triggers at each one. If it says 'the turn' or 'the phase' rather than 'your', it triggers in both players' turns.",
  },
  {
    name: "Gone to Ground",
    ruleRef: "13.11.01",
    aliases: ["go to ground", "going to ground", "gone to ground rule"],
    summary:
      "A hidden model has gone to ground while intervening dense terrain stops it being fully visible to the attacker, and its unit made no ranged attacks this turn or last turn, whatever abilities it has. Its detection range drops by 3\", so normally to 12\".",
  },
  {
    name: "Stratagem Definitions",
    ruleRef: "15.01.03",
    aliases: ["your unit in stratagems", "affected by a stratagem", "your stratagems", "opponent's stratagems"],
    summary:
      "A unit picked as a stratagem's target is affected by it. In a stratagem's Effect, 'your unit' means only the unit picked as its target. Your stratagems are those you use, and your opponent's are those they use.",
  },
  {
    name: "Modifying CP Cost",
    ruleRef: "15.01.01 / Universal Rules Updates",
    aliases: ["cp cost", "modifying cp", "reduced cp", "0cp", "free stratagem", "zero cp", "stratagem cost"],
    summary:
      "A stratagem can't cost below 0CP, and a cost change with no stated duration applies to that use only. A rule offering a stratagem for 0CP without naming it instead takes 1CP off that use.",
  },
  {
    name: "Using a Stratagem More Than Once",
    ruleRef: "Universal Rules Updates",
    aliases: ["using a stratagem twice", "repeat stratagem", "stratagem twice in a phase", "once per turn stratagem", "stratagem more than once"],
    summary:
      "A rule that lifts a stratagem's per-phase, per-turn, per-round or per-battle limit only works if it names that stratagem.",
  },
  {
    name: "Stratagems Preventing Targeting",
    ruleRef: "Universal Rules Updates",
    aliases: ["cannot be targeted unless within 12", "stratagem targeting 18", "within 18 stratagem", "targeting limit stratagem"],
    summary:
      "A stratagem saying its target can only be shot from within 12\" now reads 18\".",
  },
  {
    name: "Stratagems Adding New Units",
    ruleRef: "Universal Rules Updates",
    aliases: ["new unit stratagem", "identical destroyed unit stratagem", "replacement unit stratagem"],
    summary:
      "A stratagem adding a new unit identical to your destroyed unit can only be used once per battle.",
  },
  {
    name: "Bodyguard Destroyed, Leaders Split",
    ruleRef: "19.01.01",
    aliases: ["separate units after bodyguard destroyed", "attached units after their bodyguard unit is destroyed", "two leaders after bodyguard dies"],
    summary:
      "If a rule says leaders become separate units once their bodyguard is destroyed, and several are attached, they still stay together as one unit.",
  },
  {
    name: "Reserves at the End of the Battle",
    ruleRef: "20.01.02",
    aliases: ["reserves at the end", "reserves end of battle", "units still in reserves", "strategic reserves at the end of the battle"],
    summary:
      "At the end of the final turn, any units still in strategic reserves are destroyed, without triggering destroyed rules.",
  },
  {
    name: "Set Up as Reinforcements",
    ruleRef: "20.03.01 / 09.02.03",
    aliases: ["reinforcements step", "set up as reinforcements"],
    summary:
      "Set up as reinforcements means a unit that made an ingress move. Anything said to happen in the Reinforcements step takes place in the Move Units step.",
  },

  // === 25 Muster Armies (app only) ===
  {
    name: "Army Roster and Army Faction",
    ruleRef: "25.01 / 25.02",
    aliases: ["army roster", "roster", "army list", "army faction", "muster armies", "mustering", "army building", "building an army", "muster"],
    summary:
      "Record your army on a roster, on paper or in the app, and show it to your opponent before the battle. Note one faction keyword as your army faction.",
  },
  {
    name: "Battle Size",
    ruleRef: "25.03",
    aliases: ["points limit", "points", "how many points", "incursion", "strike force", "game size", "unit limit", "enhancement limit", "detachment points", "dp", "how many of the same unit"],
    summary:
      "Incursion: 1000 points, 2 Detachment Points, 2 enhancements, up to 2 units of the same datasheet name. Strike Force: 2000 points, 3 DP, 4 enhancements, up to 3 of a unit. BATTLELINE and DEDICATED TRANSPORT units get double the unit limit, and every EPIC HERO is limited to 1. In Incursion you can take a 3DP detachment as your only detachment.",
  },
  {
    name: "Fill Your Roster",
    ruleRef: "25.04",
    aliases: ["selecting units for an army", "unit enhancement limit", "roster rules", "select units"],
    summary:
      "Stay within the battle size's limits and any restrictions from your rules and units. No unit, attached or not, can have more than one enhancement. Units must have your faction keyword or be available to your army faction, and can take any wargear or options they have.",
  },
  {
    name: "Selecting Detachments",
    ruleRef: "25.04",
    aliases: ["select detachments", "detachment selection", "choosing detachments", "same detachment twice"],
    summary:
      "Spend Detachment Points on detachments available to your army faction, and each can only be taken once. They give force dispositions, detachment rules, enhancements or stratagems. Follow any detachment rule about units or detachments you must or can't include.",
  },
  {
    name: "Warlord",
    ruleRef: "25.04",
    aliases: ["warlord keyword", "choosing a warlord", "who is my warlord", "select warlord"],
    summary:
      "Pick one CHARACTER unit with your army faction keyword, then one CHARACTER model in it as Warlord; it gains the WARLORD keyword. If a unit must be your WARLORD and you take it, pick one of those. A rule saying a model can't be your WARLORD overrides one requiring it.",
  },
  {
    name: "Enhancements and Upgrades",
    ruleRef: "25.04",
    aliases: ["enhancement", "enhancements", "upgrade", "upgrades", "who can take enhancements", "enhancement rules"],
    summary:
      "Add the points cost and give each enhancement from your detachments to a different CHARACTER unit, on one CHARACTER model in it. EPIC HEROES can't take them, and you can't take the same one twice. Upgrades can go on non-CHARACTER units, and up to three of the same one are allowed; repeats still cost points but don't count towards the limit.",
  },
];
