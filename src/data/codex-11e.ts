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

export const DETACHMENT_OVERRIDES_11E: DetachmentOverride[] = [
  // --- Orks: BSData leaves out these rules' result tables and psychic abilities ---
  {
    faction: "Orks",
    name: "Madcap Meks",
    ability: {
      name: "Unpredictable Genius",
      description:
        "In your Shooting phase, when a friendly BIG MEK/MEK GUNZ/MORKANAUT/WAZBOM BLASTAJET unit aims all of its ranged attacks at one enemy unit, roll a D6:\n" +
        "- 1, Dat's Weird: the target has a 4+ invulnerable save until your unit has finished shooting.\n" +
        "- 2-3, Hop Splat: pick another enemy unit within 3\" of the target; it suffers D3 mortal wounds.\n" +
        "- 4, Seekerz: those attacks get +1 to hit.\n" +
        "- 5, Lifted: until your unit has finished shooting, the target has FLY and can't get the benefit of cover.\n" +
        "- 6, Runtified: the target has -1 T until your unit has finished shooting.",
    },
  },
  {
    faction: "Orks",
    name: "Dread Mob",
    ability: {
      name: "Try Dat Button!",
      description:
        "In your Shooting phase or the Fight phase, when a friendly ORKS WALKER unit (excluding TITANIC units) is selected to attack, you can roll one D6 or two D6 (re-roll any duplicate until the dice differ). The unit's attacks get the result of each die: 1-2, +1 A; 3-4, +2 S; 5-6, +1 AP. If you rolled two dice, the unit makes one hazard roll after it has attacked.",
    },
  },
  {
    faction: "Orks",
    name: "Wurrband",
    ability: {
      name: "Powers of da Waaagh!",
      description:
        "Friendly ORKS PSYKER models' [PSYCHIC] attacks get +1 S, plus another +1 S for every 5 models in the unit (or embarked within the model).\n" +
        "Friendly ORKS PSYKER models also have two psychic level 1 abilities. For each, the unit must not be battle-shocked; roll a D6 as its psychic roll, and on a 1 the unit becomes battle-shocked.\n" +
        "- Roar of Mork (your Movement phase): pick one enemy unit within 12\" that isn't a MONSTER/VEHICLE; it makes a battle-shock roll, at -1 for every 10 models in the psyker's unit.\n" +
        "- Visions of Violence (start of the Fight phase): the unit has Fights First.",
    },
  },
  // --- Adeptus Custodes: the six Shield Host detachments BSData lacks, plus
  // Null Maiden Vigil's Creeping Dread aura, which BSData names but doesn't
  // describe. The saved pages show no Force Disposition for the new six.
  ...(
    [
      ["Aquilan Shield", "Gilded Guardians",
        "While a friendly ADEPTUS CUSTODES unit (excluding MONSTER/VEHICLE units) is within range of an objective, ranged attacks against it whose S is greater than its T get -1 to wound.\n" +
        "Favoured ka'tah, Salvus: when a unit uses it, the unit's ranged attacks also get +6\" range."],
      ["Dread Host", "Instruments of the Emperor's Wrath",
        "Friendly ADEPTUS CUSTODES units can re-roll charge rolls.\n" +
        "Favoured ka'tah, Dacatarai: when a unit uses it, enemy units engaged with that unit also pile in and consolidate 2\" less."],
      ["Emperor's Chosen", "Magna Imperator",
        "When a friendly ADEPTUS CUSTODES unit is selected to attack, its attacks can re-roll one hit roll and one wound roll.\n" +
        "Favoured ka'tah, Rendax: when a unit uses it, you can also pick one enemy MONSTER/VEHICLE unit engaged with it and roll a D6: on 1-2 that unit suffers 1 mortal wound, on 3-5 D3 mortal wounds, on a 6 3 mortal wounds."],
      ["Emissaries Imperatus", "Heralds of the Throne",
        "Friendly ADEPTUS CUSTODES units have Fights First.\n" +
        "Favoured ka'tah, Conservai: when a unit uses it, until the end of the turn, advancing or falling back also doesn't stop the unit being eligible to start an action."],
      ["Shadowkeepers", "Wardens of the Dark Cells",
        "While a friendly ADEPTUS CUSTODES unit (excluding MONSTER/VEHICLE units) is within range of an objective, melee attacks against it whose S is greater than its T get -1 to wound.\n" +
        "Favoured ka'tah, Kaptaris: when a unit uses it, you can also pick one enemy unit engaged with it; that enemy unit makes a battle-shock roll at -1. Each enemy unit can be picked this way only once per phase."],
      ["Solar Watch", "Talon Sortie",
        "Falling back doesn't stop a friendly ADEPTUS CUSTODES unit being eligible to charge.\n" +
        "Favoured ka'tah, Calistus: when a unit uses it, the unit also gets +2\" M."],
    ] as const
  ).map(([name, ruleName, description]) => ({
    faction: "Adeptus Custodes",
    name,
    ability: { name: ruleName, description },
    detachmentPoints: 1,
    restrictionTags: ["Shield Host"],
  })),
  {
    faction: "Adeptus Custodes",
    name: "Null Maiden Vigil",
    ability: {
      name: "Silent Sisterhood",
      description:
        "You can pick a friendly ANATHEMA PSYKANA CHARACTER model as your WARLORD. Friendly PROSECUTOR SQUAD units have BATTLELINE.\n" +
        "Friendly ANATHEMA PSYKANA units have Creeping Dread (Aura): in the Battle-shock step of your opponent's Command phase, each enemy unit within 12\" that is a PSYKER unit or below its starting strength makes a battle-shock roll at -1.",
    },
  },
];

export const ENHANCEMENT_OVERRIDES_11E: EnhancementOverride[] = [
  // --- Orks: missing from BSData, or BSData's text is garbled ---
  {
    faction: "Orks",
    detachment: "Brute Bosses",
    name: "Da Gobshot Thunderbuss",
    points: 20,
    description:
      "WARBOSS model only. The model gains a ranged weapon, Da Gobshot Thunderbuss: Range 24\", A 6, BS 4+, S 7, AP -2, D 2, [LETHAL HITS: non-MONSTER/VEHICLE], [RAPID FIRE 6].",
  },
  {
    faction: "Orks",
    detachment: "Wurrband",
    name: "Da Krunch",
    points: 10,
    description:
      "ORKS PSYKER model only. The model gains a ranged weapon, Da Krunch: Range 24\", A 3, BS 4+, S 5, AP -1, D 1, [BLAST 3], [HAZARDOUS], [LETHAL HITS], [PSYCHIC].",
  },
  {
    faction: "Orks",
    detachment: "Wurrband",
    name: "'Eadbanger",
    points: 15,
    description:
      "ORKS PSYKER model only. The model gains a ranged weapon, 'Eadbanger: Range 24\", A 2, BS 4+, S 6, AP -3, D 3, [HAZARDOUS], [PRECISION], [PSYCHIC].",
  },
  {
    faction: "Orks",
    detachment: "Shoota Boyz",
    name: "Supa-glowy Fing",
    points: 25,
    description:
      "ORKS INFANTRY model only (not WEIRDBOY models). The model's ranged attacks gain [ANTI-INFANTRY 4+], [DEVASTATING WOUNDS] and [SUPA-HAZARDOUS]. [SUPA-HAZARDOUS] is a doubled [HAZARDOUS]: after the unit has shot, it makes two hazard rolls for each such weapon it selected.",
  },
  {
    faction: "Orks",
    detachment: "Madcap Meks",
    name: "Temperamental Shokka",
    points: 20,
    description:
      "BIG MEK WITH SHOKK ATTACK GUN model only. In your Shooting phase, when the unit is selected to shoot, you can roll a D6 for the model's Shokk Attack Gun: on a 1 it gains [TORRENT] and the model is destroyed once the unit has shot; on 2-5 it gets +1 A; on a 6 it gains [SUSTAINED HITS 2].",
  },
  {
    faction: "Orks",
    detachment: "Taktikal Brigade",
    name: "Kill Kommanda",
    points: 20,
    description: "BIG MEK/WARBOSS INFANTRY model only. While the model is part of an attached unit, it has Infiltrators and Stealth.",
  },
  // --- Space Marines: missing from BSData ---
  {
    faction: "Adeptus Astartes - Space Marines",
    detachment: "Assault Brethren",
    name: "Imperium's Sword",
    points: 20,
    description: "ADEPTUS ASTARTES model only. The model gains a melee weapon, Imperium's Sword: Melee, A 6, WS 2+, S 7, AP -3, D 3.",
  },
  ...["Phobos Shadow Force", "Phobos Shock Force"].map((detachment) => ({
    faction: "Adeptus Astartes - Space Marines",
    detachment,
    name: "Venator Omni-Auspex",
    points: 15,
    description:
      "PHOBOS model only. The unit's attacks against a hidden unit can re-roll wound rolls of 1, or wound rolls of 1-2 if the assault doctrine is active for the unit.",
  })),
  {
    faction: "Adeptus Astartes - Space Marines",
    detachment: "Deathwatch Support",
    name: "Beacon Angelis",
    points: 25,
    description:
      "ADEPTUS ASTARTES model only. If the unit is a KILL TEAM unit, it has Deep Strike, and the Rapid Ingress stratagem costs 1CP less when it targets this unit.",
  },
  // --- Adeptus Custodes: the codex's full set, in our own words. BSData drops
  // each enhancement's "X model only" eligibility, has Leonine Ferocity as
  // once per unit (the codex says per army), and lacks Emperor's Light and
  // Auriferous Orb.
  { faction: "Adeptus Custodes", detachment: "Guardians of the Throne", name: "Bane of Abominations", points: 20, description: "ADEPTUS CUSTODES model only. The model's attacks get +1 to wound against CHARACTER, MONSTER and VEHICLE units." },
  { faction: "Adeptus Custodes", detachment: "Guardians of the Throne", name: "Emperor's Light", points: 15, description: "ADEPTUS CUSTODES model only. The model gains a melee weapon, Emperor's Light: Melee, A 3, WS 2+, S 5, AP -2, D 2, [EXTRA ATTACKS]." },
  { faction: "Adeptus Custodes", detachment: "Guardians of the Throne", name: "Castellan's Mark", points: 25, description: "ADEPTUS CUSTODES model only. After both armies have deployed, you can redeploy up to three friendly ADEPTUS CUSTODES units, and any of them can go into strategic reserves however many units are already there." },
  { faction: "Adeptus Custodes", detachment: "Guardians of the Throne", name: "Eagle's Eye", points: 30, description: "ADEPTUS CUSTODES model only. The model has +1 W. Once per battle, per army, when attacks are allocated to it, you can give it a 3+ invulnerable save against them." },
  { faction: "Adeptus Custodes", detachment: "Aquilan Shield", name: "Not a Shell Wasted", points: 10, description: "ADEPTUS CUSTODES INFANTRY model only. The unit's ranged attacks get +1 A." },
  { faction: "Adeptus Custodes", detachment: "Aquilan Shield", name: "Pareldor's Caducatrix", points: 30, description: "ADEPTUS CUSTODES model only. Once per battle, per army, at the start of any phase, the model heals D3+3 wounds." },
  { faction: "Adeptus Custodes", detachment: "Dread Host", name: "Flawless Bladework", points: 15, description: "ADEPTUS CUSTODES model only. The model's melee attacks gain [SUSTAINED HITS 1]." },
  { faction: "Adeptus Custodes", detachment: "Dread Host", name: "Auric Exemplar", points: 15, description: "ADEPTUS CUSTODES model only. The model's melee attacks gain [CLEAVE 1]." },
  { faction: "Adeptus Custodes", detachment: "Emperor's Chosen", name: "From the Hall of Armouries", points: 15, description: "ADEPTUS CUSTODES model only. The model's melee attacks gain [DEVASTATING WOUNDS]." },
  { faction: "Adeptus Custodes", detachment: "Emperor's Chosen", name: "Radiant Mantle", points: 40, description: "ADEPTUS CUSTODES INFANTRY model only. Attacks against the unit get -1 to hit." },
  { faction: "Adeptus Custodes", detachment: "Emissaries Imperatus", name: "Edge of the Blade", points: 15, description: "ADEPTUS CUSTODES model only. If the unit made a charge move this turn, the model's attacks can re-roll hit rolls of 1 and wound rolls of 1." },
  { faction: "Adeptus Custodes", detachment: "Emissaries Imperatus", name: "Auriferous Orb", points: 20, description: "ADEPTUS CUSTODES model only. The model gains a ranged weapon, Auriferous Orb: Range 12\", A 3, BS 2+, S 1, AP 0, D 1, [ANTI-non-MONSTER/VEHICLE 2+], [BLINDING LIGHT], [DEVASTATING WOUNDS]. [BLINDING LIGHT]: after the unit has shot in your Shooting phase, pick one enemy unit the Orb hit; its attacks get -1 to hit until the start of your next turn." },
  { faction: "Adeptus Custodes", detachment: "Shadowkeepers", name: "Unstoppable Destroyer", points: 25, description: "ADEPTUS CUSTODES INFANTRY model only. When the unit makes a pile-in or consolidation move, it can move up to 4\", and it can use any consolidation mode regardless of that move's Before Moving restrictions." },
  { faction: "Adeptus Custodes", detachment: "Shadowkeepers", name: "Genalchemic Warding", points: 30, description: "ADEPTUS CUSTODES model only. The model has Feel No Pain 5+." },
  { faction: "Adeptus Custodes", detachment: "Solar Watch", name: "Sally Forth", points: 30, description: "ADEPTUS CUSTODES SHIELD-CAPTAIN model only. At the start of your Charge phase, pick one friendly ADEPTUS CUSTODES INFANTRY unit within 6\" of the model: if it advanced this turn, it can still declare a charge." },
  { faction: "Adeptus Custodes", detachment: "Solar Watch", name: "Auric Eagle", points: 15, description: "ADEPTUS CUSTODES INFANTRY/MOUNTED unit only (not TERMINATOR units). The unit gets +1 to advance rolls and charge rolls." },
  { faction: "Adeptus Custodes", detachment: "Honoured Companions", name: "Arae-shrike", points: 20, description: "ADEPTUS CUSTODES INFANTRY model only. Enemy units making an ingress move can't be set up within 12\" of the unit." },
  { faction: "Adeptus Custodes", detachment: "Honoured Companions", name: "Celeritous Sentries", points: 15, description: "TRUSTED SENTINEL unit only. Once per phase, per unit, you can use the Heroic Intervention stratagem on the unit even if it was already used this phase. That use costs 1CP less and doesn't stop the stratagem being used on other units this phase." },
  { faction: "Adeptus Custodes", detachment: "Auric Champions", name: "Shroud of the Hidden Blade", points: 20, description: "ADEPTUS CUSTODES model only. The model has Stealth and Lone Operative." },
  { faction: "Adeptus Custodes", detachment: "Auric Champions", name: "Superior Creation", points: 30, description: "ADEPTUS CUSTODES INFANTRY model only. Once per battle, per army, at the end of a phase in which the model was destroyed, roll a D6: on a 2+, set it back up, unengaged, as close as possible to where it was destroyed, with 3 wounds remaining. (The saved page flags an erratum for this enhancement that it doesn't show.)" },
  { faction: "Adeptus Custodes", detachment: "Auric Champions", name: "Inspirational Exemplar", points: 10, description: "ADEPTUS CUSTODES INFANTRY model only. Once per battle round, per army, at the start of any phase, pick one battle-shocked friendly ADEPTUS CUSTODES unit within 9\" of the model: it is no longer battle-shocked." },
  { faction: "Adeptus Custodes", detachment: "Lions of the Emperor", name: "Lightning Descent", points: 20, description: "SHIELD-CAPTAIN IN ALLARUS TERMINATOR ARMOUR model only. The unit can make an ingress move in your first Movement phase." },
  { faction: "Adeptus Custodes", detachment: "Lions of the Emperor", name: "Leonine Ferocity", points: 20, description: "SHIELD-CAPTAIN IN ALLARUS TERMINATOR ARMOUR model only. Once per phase, per army, you can use the Rapid Ingress stratagem on the unit even if it was already used this phase. That use costs 1CP less and doesn't stop the stratagem being used on other units this phase." },
  { faction: "Adeptus Custodes", detachment: "Might of the Moritoi", name: "Memento Moritoi", points: 30, description: "One per army. ADEPTUS CUSTODES DREADNOUGHT model only. The model's melee attacks get +1 A, +1 S and +1 D." },
  { faction: "Adeptus Custodes", detachment: "Might of the Moritoi", name: "Augury Uplink", points: 30, description: "One per army. ADEPTUS CUSTODES DREADNOUGHT model only. The model has Feel No Pain 5+." },
  { faction: "Adeptus Custodes", detachment: "Grav-Assault Force", name: "Anti-Gravitic Mobility", points: 15, description: "GRAV-ASSAULT unit only. Falling back doesn't stop the unit shooting." },
  { faction: "Adeptus Custodes", detachment: "Grav-Assault Force", name: "Combat Deployment", points: 20, description: "GRAV-ASSAULT TRANSPORT model only. When a friendly ADEPTUS CUSTODES unit disembarks from it, until the end of the turn that unit can re-roll charge rolls and enemy units can't target it with snap shooting attacks." },
  { faction: "Adeptus Custodes", detachment: "Null Maiden Vigil", name: "Oblivion Knight", points: 15, description: "ANATHEMA PSYKANA model only. The unit's attacks get +1 to hit, or +1 to hit and +1 to wound against a PSYKER or battle-shocked target." },
  { faction: "Adeptus Custodes", detachment: "Null Maiden Vigil", name: "Huntress' Eye", points: 10, description: "ANATHEMA PSYKANA model only. In your Movement phase, you can pick one visible enemy unit within 12\" of the unit: it makes a battle-shock roll at -1." },
];

export const UNIT_ABILITY_OVERRIDES_11E: UnitAbilityOverride[] = [
  // Orks army rule. BSData leaves out the once-per-battle War Cry.
  {
    faction: "Orks",
    name: "Waaagh!",
    description:
      "Friendly ORKS units with this ability can re-roll advance rolls, and can become riled up when another rule says so. While a unit is riled up, it has a 5+ invulnerable save, its ranged attacks have [ASSAULT], and advancing doesn't stop it being eligible to declare a charge.\n" +
      "War Cry (once per battle, per army): at the start of the Command phase, you can call the Waaagh!. Friendly ORKS units with this ability are then riled up until the end of the next turn.",
  },
  // Adeptus Custodes army rule. BSData names the ka'tah abilities but doesn't list them.
  {
    faction: "Adeptus Custodes",
    name: "Martial Ka'tah",
    description:
      "At the start of your Command phase, friendly ADEPTUS CUSTODES units with this ability become readied. A readied unit can use one of the ka'tah abilities below; doing so means it is no longer readied.\n" +
      "- Conservai (your Command phase, one readied unit): until the end of the turn, being engaged or battle-shocked doesn't stop the unit starting an action, and starting an action doesn't stop it shooting.\n" +
      "- Calistus (your Movement phase, when a readied unit is selected to move): its normal, advance and fall-back moves can pass through all models.\n" +
      "- Salvus (your Shooting phase, when a readied unit is selected to shoot): it ignores modifiers to its BS and to its hit and wound rolls.\n" +
      "- Dacatarai (start of the Fight phase, one readied unit): its melee attacks against units other than MONSTER/VEHICLE units can re-roll hit rolls of 1.\n" +
      "- Kaptaris (start of the Fight phase, one readied unit): melee attacks against it get -1 to hit.\n" +
      "- Rendax (Fight phase, when a readied unit is selected to fight): its melee attacks gain [LETHAL HITS: MONSTER/VEHICLE].\n" +
      "Favoured Ka'tah: each Shield Host detachment names one ka'tah that gains an extra effect when used (see that detachment's rule).",
  },
];
