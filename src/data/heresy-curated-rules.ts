/**
 * Hand-written Horus Heresy entries for things players ask about that the rulebook spreads over
 * several sections or puts in a table. Own words, each pointing at the sections it summarises;
 * the lookup returns the sections themselves too. Not from BSData or Wahapedia text.
 */
import type { HeresySpecialRule } from "../types.js";

export const HERESY_CURATED_RULES: HeresySpecialRule[] = [
  {
    name: "Snap Shots",
    aliases: ["Snap Shot", "Snapshot", "Snap Fire"],
    summary: "Snap Shots are Ranged Hit Tests made on a worse row of the Ranged Hit Test Table.",
    description:
      "A Hit Test made as a Snap Shot uses the Snap Shots row of the Ranged Hit Test Table instead of the firer's normal Target Number: " +
      "BS 10+ hits on 2+, BS 9 or 8 on 3+, BS 7 or 6 on 4+, BS 5 or 4 on 5+, BS 3 or 2 on 6+, BS 1 can't hit. Snap Shots never score Critical Hits from the table.\n\n" +
      "The rules make attacks Snap Shots when:\n" +
      "- making Volley Attacks during a Charge (only Assault weapons may fire); the Overwatch Reaction instead lets the target fire any weapon at full BS;\n" +
      "- a model makes more than one Shooting Attack in a phase at different targets: every attack after the first is Snap Shots (Super-heavy vehicles are exempt);\n" +
      "- a Super-heavy vehicle fires after Rushing;\n" +
      "- making an Intercept Reaction (vehicles may only fire Defensive weapons);\n" +
      "- firing a weapon with the Centreline arc of fire, unless another rule says otherwise;\n" +
      "- shooting at a Titan's Head profile;\n" +
      "- firing weapons on a Titan's Arms once the Arms are Crippled.\n\n" +
      "Return Fire is a normal Shooting Attack at full BS: it isn't Snap Shots. Heavy (X) doesn't cause Snap Shots in Heresy; it adds +1 to a characteristic when the unit stayed Stationary.",
    source: "Skully summary of the Horus Heresy 3rd Edition core rules (Ranged Hit Tests, Charge Sub-Phase, Shooting Phase, Legio Titanicus)",
    gameSystem: "horus-heresy-3e",
    kind: "core rule",
    context: "Summary: Ranged Hit Tests > Snap Shots",
  },
];

/** Rulebook sections and the names players use for them (search-only aliases). */
export const HERESY_SPOKEN_NAMES: Record<string, string[]> = {
  "Ranged Hit Tests": ["to hit", "ballistic skill", "hit roll", "shooting to hit", "hit chart", "to hit chart", "hit table"],
  "Melee Hit Tests": ["melee to hit", "weapon skill", "combat to hit"],
  "Armour Penetration Test": ["glancing hit", "penetrating hit", "glance", "pen", "armour pen", "penetration", "armour value"],
  "Vehicle Damage Table": ["vehicle damage", "damage chart"],
  "Reaction Allotments": ["reaction points", "reaction point", "how many reactions"],
  "4. Make Volley Attacks": ["volley fire", "volley attacks", "volley"],
  "Wound Tests": ["to wound", "wound roll"],
  "Cover Tests": ["cover save", "cover"],
  "Invulnerable Tests": ["invulnerable save", "invuln"],
  // 40K and everyday words for Heresy sections (2026-11-14 query battery)
  Rush: ["run", "running", "advance", "advancing", "move faster"],
  Antigrav: ["skimmer"],
  Flyers: ["flier", "fliers", "aircraft", "planes"],
  Walker: ["dreadnought", "dreadnoughts"],
  "The Knight Sub-type": ["knights", "knight", "imperial knight", "questoris"],
  "Challenge Sub-Phase": ["duel", "duels", "challenges"],
  "Aftermath Options": ["sweeping advance", "consolidate", "consolidation", "pursue", "disengage", "hold", "after combat", "fall back from combat"],
  "Moving Through Other Units": ["tank shock", "tank shocking", "ram", "ramming", "run over", "running over", "move through"],
  "Death or Glory": ["stand in front of a tank", "death or glory"],
  "Charging a Vehicle": ["charging a tank", "charge a tank", "assault a vehicle"],
  "Attacking Vehicles in Combat": ["hitting a tank in melee", "melee against vehicles", "punch a tank", "fight a vehicle"],
  "Fight Sub-Phase": ["melee", "close combat", "fighting", "fight"],
  "2. Declare Weapons and Set Initiative Steps": ["who strikes first", "who hits first", "strike order"],
  "Emergency Disembarkation": ["transport destroyed", "transport blown up", "transport explodes"],
  "The Turn Sequence": ["phases", "order of phases", "turn order", "sequence"],
  "Seize The Initiative": ["who goes first", "first turn", "go first"],
  "8. Play Core Mission": ["how many turns", "game length", "how long is the game", "last turn"],
  "Targeting a Titan": ["titan locations", "titan hit location", "which part of a titan", "shoot a titan"],
  "Crippling and Destroying Titans": ["killing a titan", "kill a titan", "destroy a titan", "crippled", "titan destroyed"],
  "Titan Critical Damage Table": ["reactor meltdown", "titan critical", "critical damage"],
  "Damage Characteristics": ["hull points", "hull point", "hp"],
  "Vehicles and Damage": ["rear armour", "side armour", "front armour", "facing", "facings", "armour facing"],
  "Line of Sight": ["can i see", "see the target", "visibility"],
  "Shooting Phase: Return Fire": ["shoot back", "returning fire"],
  "3. Make Set-up Move": ["setup move", "set up move"],
  "Assault Phase: Overwatch": ["shoot when charged", "stand and shoot", "shoot the chargers", "shooting at chargers", "over watch"],
  "Heavy (X)": ["moving and shooting heavy weapons", "heavy weapon moved", "heavy weapons"],
  "Moved vs Stationary": ["stationary", "moved", "did not move"],
  "Vehicles in the Movement Phase": ["pivot", "pivoting", "turning a tank", "turn a vehicle"],
  Template: ["flamer", "flamer template", "flame template"],
  Suppressed: ["suppression"],
  Routed: ["running away", "flee", "fleeing"],
  "Infiltrate (X)": ["scout move", "scouts", "infiltrate"],
  Subterranean: ["tunnels", "tunnel", "underground"],
  "Core Mission Primary Objectives": ["holding objectives", "objective control", "control objectives"],
};
