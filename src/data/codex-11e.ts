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
];
