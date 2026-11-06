/**
 * Official Warhammer 40,000 11th Edition updates and FAQ rulings, for lookup_faq.
 *
 * Every entry is in our own words, written from GW's free PDFs read on 2026-11-06:
 * - Universal Rules Updates v1.1 (also the "Universal Rules Updates" section of
 *   the app's Rules Appendix, whose wording matches).
 * - Warhammer Event Companion v1.3: the Chapter Approved Mission Deck FAQ
 *   (no errata listed), the card wording notes, the event CP cap, pairing and
 *   ranking advice.
 * - The "FAQs" section of each current Faction Pack (see FACTION_PACKS in
 *   stratagem-sources.ts for versions; Chaos Knights lists none).
 * - Printed Product Updates for Space Marines v1.1 and Adeptus Custodes v1.0.
 *
 * Not here: the packs' "Rules Updates" (errata). Those that change a stratagem
 * are applied in stratagems.ts; army-rule, detachment-rule, enhancement and
 * datasheet errata are not reproduced here.
 */

export interface Faq11eEntry {
  question: string;
  answer: string;
  /** A key of FAQ_SOURCES. */
  source: keyof typeof FAQ_SOURCES;
  /** STRATAGEMS-style faction label; absent for rulings that apply to every army. */
  faction?: string;
}

const ASSETS = "https://assets.warhammer-community.com/";

export const FAQ_SOURCES = {
  universal: { label: "Universal Rules Updates v1.1 (matched play from 26 Aug 2026)", url: `${ASSETS}eng_wh40k_core&key_universal_rules_updates-lu3grocned-rphh78bl6k.pdf` },
  event: { label: "Warhammer Event Companion v1.3 (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_event_companion-rdwnqprl4c-nj8oqogadv.pdf` },
  tyranids: { label: "Tyranids Faction Pack v1.3 FAQ (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_faction_pack_tyranids-an12izciwp-np2hnkcsje.pdf` },
  necrons: { label: "Necrons Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_necrons-1urphgbmpy-wbhocjbaba.pdf` },
  tau: { label: "T'au Empire Faction Pack v1.2 FAQ (26 Aug 2026)", url: `${ASSETS}eng_wh40k_faction_pack_tau_empire-sxhzmfrlud-mpzjzuhupn.pdf` },
  deathGuard: { label: "Death Guard Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_death_guard-bp5c8lcjq6-i4ew7urwyk.pdf` },
  csm: { label: "Chaos Space Marines Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_chaos_space_marines-xlmrglqa2b-zd2fzntrqu.pdf` },
  astra: { label: "Astra Militarum Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_astra_militarum-1hevkhdpmv-stfkch2tsz.pdf` },
  aeldari: { label: "Aeldari Faction Pack v1.4 FAQ (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_-faction_pack_aeldari-seqmcs1mu0-g8gzewikcm.pdf` },
  sororitas: { label: "Adepta Sororitas Faction Pack v1.4 FAQ (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_-faction_pack_adepta_sororitas-kby0nywexj-dg7kvr3iiy.pdf` },
  custodes: { label: "Adeptus Custodes Faction Pack v1.2 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_adeptus_custodes-xlscee8b1b-b1evo9u920.pdf` },
  custodesPrinted: { label: "Adeptus Custodes Printed Product Updates v1.0 (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_printed_product_updates_adeptus_custodes_updates-fmj4bdwwhh-0qshh8eauk.pdf` },
  spaceMarinesPrinted: { label: "Space Marines Printed Product Updates v1.1 (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_printed_product_updates_space_marines_updates-91hillwcff-wzs8qnozam.pdf` },
  admech: { label: "Adeptus Mechanicus Faction Pack v1.4 FAQ (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_-faction_pack_adeptus-mechanicus-g0jwiuyz3x-f5itnst9j9.pdf` },
  daemons: { label: "Chaos Daemons Faction Pack v1.2 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_chaos_daemons-e67vyzvv3x-mownb49uc3.pdf` },
  drukhari: { label: "Drukhari Faction Pack v1.2 FAQ (26 Aug 2026)", url: `${ASSETS}eng_wh40k_faction_pack_drukhari-p7mpvgnmnn-clii96hzh6.pdf` },
  emperorsChildren: { label: "Emperor's Children Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_emperors_children-xp2mhzppxs-1cvykicdxu.pdf` },
  genestealerCults: { label: "Genestealer Cults Faction Pack v1.1 FAQ (22 Jul 2026)", url: `${ASSETS}eng_22-07_warhammer_40,000_faction_pack_genestealer_cults-vmkwgeydbr-sh7picbeqo.pdf` },
  greyKnights: { label: "Grey Knights Faction Pack v1.2 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_grey_knights-jnrahwb1qf-ubjtmdlivm.pdf` },
  agents: { label: "Imperial Agents Faction Pack v1.3 FAQ (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_-faction_pack_imperial_agents-5bv5lemlti-phvkqckp17.pdf` },
  imperialKnights: { label: "Imperial Knights Faction Pack v1.2 FAQ (26 Aug 2026)", url: `${ASSETS}eng_wh40k_faction_pack_imperial_knights-n1irjnjygs-w8jfnk8kdn.pdf` },
  votann: { label: "Leagues of Votann Faction Pack v1.2 FAQ (14 Oct 2026)", url: `${ASSETS}eng_14-10_wh40k_faction_pack_leagues_of_votann-os3nsdjlao-buac8a7pzn.pdf` },
  thousandSons: { label: "Thousand Sons Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_thousand_sons-4lioijwxdj-otjrinzt8c.pdf` },
  worldEaters: { label: "World Eaters Faction Pack v1.3 FAQ (30 Sep 2026)", url: `${ASSETS}eng_30-09_wh40k_faction_pack_world_eaters-rxxj1fzeoh-kfx1cectxb.pdf` },
} as const;

const TYR = "Tyranids", NEC = "Necrons", TAU = "T'au Empire", DG = "Death Guard", CSM = "Heretic Astartes";
const AM = "Astra Militarum", ELD = "Aeldari", AS = "Adepta Sororitas", AC = "Adeptus Custodes", AMEC = "Adeptus Mechanicus";
const CD = "Legiones Daemonica", DRU = "Drukhari", EC = "Emperor's Children", GSC = "Genestealer Cults", GK = "Grey Knights";
const AOI = "Agents of the Imperium", IK = "Imperial Knights", LOV = "Leagues of Votann", TS = "Thousand Sons", WE = "World Eaters";

export const FAQ_11E: Faq11eEntry[] = [
  // === Universal Rules Updates ===
  { source: "universal", question: "A rule lets me target a unit with a stratagem for free (0CP) without naming the stratagem. Is it really free? Modifying a stratagem's CP cost.", answer: "No. Unless the rule names that stratagem, it only takes 1CP off that use." },
  { source: "universal", question: "Can a rule let me use a stratagem twice in a phase, on another unit, or go past its once per turn, round or battle limit?", answer: "Only if that rule names the stratagem. A rule that doesn't name it can't lift those limits." },
  { source: "universal", question: "A stratagem says my unit can only be targeted by ranged attacks from within 12 inches. Does that still apply? Stratagems that prevent units from being targeted.", answer: "It now reads 18 inches: the unit can only be picked as the target of a ranged attack if the attacker is within 18\"." },
  { source: "universal", question: "How often can I use a stratagem that adds a new unit to my army identical to my destroyed unit?", answer: "Once per battle. Every stratagem with that effect gains that restriction." },
  { source: "universal", question: "A rule lets my unit charge after disembarking from a transport that made a normal move. What kind of move does it disembark with?", answer: "An assault disembark move (18.06) rather than a disembark move." },
  { source: "universal", question: "A rule lets my unit disembark from a transport that advanced. What kind of move does it disembark with?", answer: "A shock disembark move (18.07) rather than a disembark move." },

  // === Event Companion: Chapter Approved Mission Deck FAQ ===
  { source: "event", question: "Plunder secondary mission: does 'not within your territory' mean the unit or the terrain area?", answer: "The terrain area." },
  { source: "event", question: "My Beacon unit from the Beacon secondary mission was destroyed before I achieved it. Can I pick a new Beacon unit?", answer: "No, so that mission can no longer be achieved. GW suggests discarding it on your turn for 1CP." },
  { source: "event", question: "Is the end of the battle the same as the end of the fifth battle round for VP limits? Does the 15VP per round cap apply to end of battle scoring?", answer: "No. VP scored at the end of the battle don't count towards the 15VP per battle round limit." },
  { source: "event", question: "If a mission action placed an operation marker and applied a status such as decoyed, does removing the marker remove the status?", answer: "Yes." },
  { source: "event", question: "Can I remove operation markers placed by my Primary Mission card?", answer: "Only how and when the card says. If it doesn't say, you can't remove them." },
  { source: "event", question: "Death Trap primary mission: does the terrain area have to be trapped at the moment the enemy unit is destroyed?", answer: "No." },
  { source: "event", question: "Surveil the Foe primary mission: the surveilled enemy unit is in range of an objective with an operation marker. Can I still score by removing that marker later the same turn?", answer: "Yes, as long as it's within the same turn." },
  { source: "event", question: "Vital Link primary mission: with more than one central objective, do my operation markers score the cumulative VP on any of them?", answer: "Yes, as long as you control the objectives those markers are in." },
  { source: "event", question: "Do Chapter Approved Mission Deck cards have errata?", answer: "None are listed in Event Companion v1.3." },

  // === Event Companion: card wording and event rules ===
  { source: "event", question: "What does cumulative mean on a mission card?", answer: "A cumulative condition follows a normal one. Achieving it scores the VP for both." },
  { source: "event", question: "What does 'or' mean on a mission card condition?", answer: "You can only score one of the 'or' conditions or the normal condition it follows, not several." },
  { source: "event", question: "What counts as a unit leaving the battlefield on a mission card?", answer: "Being destroyed, embarking on a transport, or being removed by a rule, such as being placed in strategic reserves." },
  { source: "event", question: "A mission card says one, underlined. What does that mean?", answer: "Exactly one, not one or more." },
  { source: "event", question: "A mission card awards VP up to a limit, such as up to 5VP. What happens to the excess?", answer: "VP over that limit are ignored." },
  { source: "event", question: "Does the When Drawn section on a secondary mission apply with Fixed missions?", answer: "No. It only applies if you're using Tactical secondary missions." },
  { source: "event", question: "Is there a limit on gaining CP at events? Maximum extra command points per battle round, including discarding secondary missions.", answer: "At events following the Companion, each player can gain at most 1CP per battle round beyond Core CP, and that includes the CP for discarding a secondary mission." },
  { source: "event", question: "How should tournament players be paired?", answer: "GW recommends by record, then by win path (when in the event the wins and losses came), then randomly among players ranked the same." },
  { source: "event", question: "How should tournament players be ranked? Tie-breakers for the final standings.", answer: "GW recommends overall record, then opponents' win records, then total VP." },

  // === Tyranids ===
  { faction: TYR, source: "tyranids", question: "Does a Biovores unit lose hidden when it uses Seed Spore Mines?", answer: "No." },
  { faction: TYR, source: "tyranids", question: "Hunting Grounds enhancement: does a unit repositioned by a rule that doesn't first put it in Reserves, such as Grey Knights Teleport Assault, take the Battle-shock test on a 2+?", answer: "Yes. Rules triggered by or applying to Reserves units also apply to a repositioned unit when it's set back up." },
  { faction: TYR, source: "tyranids", question: "Can I use Rapid Regeneration when an ability like Doombolt inflicts mortal wounds on my Tyranids unit?", answer: "No." },
  { faction: TYR, source: "tyranids", question: "Mawloc Terror From the Deep: which units take the Battle-shock test?", answer: "Only those for which a 5+ was rolled, not every unit within 12\"." },
  { faction: TYR, source: "tyranids", question: "Psychostatic Disruption against a reserves unit that a rule says must arrive in the second battle round: which wins?", answer: "'Cannot arrive' beats 'must arrive'. Roll a D6: on a 4+ that enemy unit can't arrive this turn." },
  { faction: TYR, source: "tyranids", question: "Does a Neurogaunts unit selected for a Neurotyrant's Neuroloids ability gain SYNAPSE if no SYNAPSE unit leads it?", answer: "No." },
  { faction: TYR, source: "tyranids", question: "Reclaim Biomass stratagem: can the effect be used on the unit that was just destroyed?", answer: "No." },
  { faction: TYR, source: "tyranids", question: "Does a Hive Tyrant with Tyrant Guard get Stealth from a Venomthrope's Foul Spores?", answer: "No. That attached unit has the MONSTER keyword, and the ability excludes monsters." },
  { faction: TYR, source: "tyranids", question: "Are Spore Mines added during a battle limited by abilities that stop Reserves arriving nearby, such as Infiltrators' Omni-scramblers?", answer: "No." },
  { faction: TYR, source: "tyranids", question: "Does a unit affected by Psychostatic Disruption have to arrive from Reserves in the next Movement phase?", answer: "No." },
  { faction: TYR, source: "tyranids", question: "Synaptic Goading stratagem: can the unit leave Engagement Range and move toward the closest objective marker?", answer: "Yes." },
  { faction: TYR, source: "tyranids", question: "Can a unit forced to test by Shadow in the Warp use Insane Bravery?", answer: "No. Insane Bravery can only be used in your own Command phase." },
  { faction: TYR, source: "tyranids", question: "Subterranean Assault: does a Mawloc's Terror from the Deep trigger when it arrives via a Tunnel Marker?", answer: "No." },

  // === Necrons ===
  { faction: NEC, source: "necrons", question: "Can a Cryptothrall that fought on death with Systematic Vigour fight again if it returns to its unit before that unit is picked to fight?", answer: "Yes." },
  { faction: NEC, source: "necrons", question: "Protocol of the Undying Legions stratagem: do other Reanimation Protocols rules, such as Necron Warriors' Their Number is Legion, still apply?", answer: "Yes." },
  { faction: NEC, source: "necrons", question: "Canoptek Court: with no objectives in No Man's Land or my opponent's deployment zone, can those areas be in my Power Matrix?", answer: "No." },
  { faction: NEC, source: "necrons", question: "Cosmic Precision stratagem: can it set up a unit anywhere rather than near a battlefield edge, even without Deep Strike?", answer: "Yes." },
  { faction: NEC, source: "necrons", question: "Cosmic Precision stratagem: does a large model such as a Tesseract Vault follow Setting Up Large Models (03.02.02)?", answer: "Yes." },
  { faction: NEC, source: "necrons", question: "Protocol of the Conquering Tyrant or Lokhust Destroyers' Hard-wired for Destruction: to re-roll the hit roll, must the unit also be eligible to re-roll a hit roll of 1?", answer: "Yes, under Rules with Multiple Conditions and Effects (Rules Appendix 02.03.01)." },
  { faction: NEC, source: "necrons", question: "Monolith Eternity Gate: must the unit set up wholly within 6 inches of a battlefield edge?", answer: "No." },
  { faction: NEC, source: "necrons", question: "Monolith Eternity Gate: if the unit isn't wholly within 6 inches of a battlefield edge, can it still shoot in my Shooting phase?", answer: "Yes." },
  { faction: NEC, source: "necrons", question: "Canoptek Court Autodivinator enhancement: does it trigger when my opponent gains CP from an army rule such as Code Chivalric, or from discarding a secondary mission?", answer: "No in both cases. It only triggers on CP your opponent gains from an ability." },
  { faction: NEC, source: "necrons", question: "Hypercrypt Legion Hyperphasing: if a removed unit has Deep Strike, can it arrive from Reserves in the first battle round?", answer: "No." },
  { faction: NEC, source: "necrons", question: "Can targeting Canoptek Wraiths with Reactive Subroutines trigger Wraith Form?", answer: "Yes." },
  { faction: NEC, source: "necrons", question: "Can a unit be affected by a Resurrection Orb more than once per turn, for example from a Catacomb Command Barge and an Overlord?", answer: "No." },

  // === T'au Empire ===
  { faction: TAU, source: "tau", question: "Can an Ethereal use Coordinated Leadership while embarked in a transport?", answer: "Yes." },
  { faction: TAU, source: "tau", question: "Kroot Hunting Pack: if Hidden Hunters leaves the attackers no eligible targets, can nearby Krootox Riders still use Kroot Packmates to shoot the attacker?", answer: "No." },

  // === Death Guard ===
  { faction: DG, source: "deathGuard", question: "Does the Plagueburst Crawler's Spore-laced Shock Waves inflict mortal wounds every turn on affected units?", answer: "No." },

  // === Chaos Space Marines ===
  { faction: CSM, source: "csm", question: "Do Plague Marines added to a Chaos Space Marines army via Cults of the Dark Gods get anything from Infused with the Blessings of Nurgle?", answer: "No." },
  { faction: CSM, source: "csm", question: "Soul Link enhancement: can the bearer use a gained datasheet ability that another Character has already used up (once per battle, once per phase)?", answer: "Yes." },
  { faction: CSM, source: "csm", question: "Soul Link enhancement: can I select a Character that isn't on the battlefield?", answer: "Yes." },
  { faction: CSM, source: "csm", question: "Soul Link enhancement: can the bearer use it while in Strategic Reserves?", answer: "Yes." },
  { faction: CSM, source: "csm", question: "Soul Link enhancement: do the replaced datasheet abilities include Core and Faction abilities?", answer: "Yes." },
  { faction: CSM, source: "csm", question: "Soul Link enhancement: does replacing abilities change which units the bearer can attach to?", answer: "No." },
  { faction: CSM, source: "csm", question: "Soul Link enhancement: do persisting effects from the replaced abilities carry on applying to the bearer?", answer: "No." },
  { faction: CSM, source: "csm", question: "Veterans of the Long War: can my focus of hatred be a unit embarked in a transport?", answer: "Yes." },
  { faction: CSM, source: "csm", question: "Opportunistic Raiders stratagem: is a unit that didn't fight this phase eligible if it was eligible to fight at some point in the phase?", answer: "Yes." },
  { faction: CSM, source: "csm", question: "Can Warp Talons use Opportunistic Raiders to fall back and then Warp Strike into Strategic Reserves?", answer: "Only if that unit destroyed one or more units this phase." },
  { faction: CSM, source: "csm", question: "Warp Talons Warp Strike: can a unit that didn't fight use it if it was eligible to fight at some point in the phase?", answer: "No." },
  { faction: CSM, source: "csm", question: "Traitor Enforcer Brutal Example: when is the destroyed model removed during Fire Overwatch?", answer: "Before resolving Fire Overwatch with that unit." },
  { faction: CSM, source: "csm", question: "Can a unit make a Dark Pact when targeted with Fire Overwatch?", answer: "Yes, because it's selected to shoot." },
  { faction: CSM, source: "csm", question: "Can I select a unit to shoot with no eligible targets just so it can make a Dark Pact?", answer: "No." },
  { faction: CSM, source: "csm", question: "Does Fabius Bile's Enhanced Warriors apply if he starts in an attached unit inside a transport?", answer: "Yes." },

  // === Astra Militarum ===
  { faction: AM, source: "astra", question: "Can Reinforcements! be used on a Battle-shocked unit?", answer: "No." },
  { faction: AM, source: "astra", question: "Can a unit with two vox-casters try to generate 1CP twice when targeted with a stratagem?", answer: "No." },
  { faction: AM, source: "astra", question: "Can a vox-caster try to generate 1CP when its unit is targeted with Reinforcements!?", answer: "No." },
  { faction: AM, source: "astra", question: "Creeping Barrage: how does the maximum number of shaken units work?", answer: "Roll a D6 for each enemy unit more than 12\" from all your models on the battlefield, one at a time in the order you choose, and stop once the battle size's maximum is shaken." },
  { faction: AM, source: "astra", question: "Can a Militarum Tempestus Command Squad with an Ogryn Bodyguard use Deep Strike?", answer: "No, because the Ogryn Bodyguard doesn't have Deep Strike." },
  { faction: AM, source: "astra", question: "Do multiple copies of the same Order stack on a unit?", answer: "No." },

  // === Aeldari ===
  { faction: ELD, source: "aeldari", question: "Windrider Host Ride the Wind: can Asuryani Mounted or Vyper units make an ingress move in the first battle round?", answer: "Yes." },
  { faction: ELD, source: "aeldari", question: "Can the Yncarne use Inevitable Death in my opponent's first turn?", answer: "Yes." },
  { faction: ELD, source: "aeldari", question: "Torc of Morai-Heg: what if my opponent can't afford the raised stratagem cost?", answer: "No CP is spent and the effects don't resolve, but the stratagem still counts as used this phase." },
  { faction: ELD, source: "aeldari", question: "Torc of Morai-Heg: must my opponent still use the stratagem at the higher cost if they can pay?", answer: "Yes." },
  { faction: ELD, source: "aeldari", question: "Yncarne Ethereal Form: can I regain fewer lost wounds than the D3 rolled?", answer: "No." },

  // === Adepta Sororitas ===
  { faction: AS, source: "sororitas", question: "How do Miracle Dice work in the attack sequence? When can an Act of Faith replace a dice?", answer: "Before rolling, the attacker can swap in a dice for a hit roll from a group of attacks, a wound roll from a group of hits, or a single damage roll. The target can swap one in for a save roll from a group of wounding attacks." },
  { faction: AS, source: "sororitas", question: "Saintly Example: if the Character dies within 12 inches of an Imagifier, can Litany of Deeds re-roll the extra D3 Miracle dice before they join the pool?", answer: "Yes." },
  { faction: AS, source: "sororitas", question: "Verse of Holy Piety: if the Character dies before the battle round ends, does the Vow of Atonement stay active for the rest of the unit until the next battle round?", answer: "Yes." },
  { faction: AS, source: "sororitas", question: "Can a Miracle dice be used as part of a re-roll?", answer: "Yes." },
  { faction: AS, source: "sororitas", question: "If I re-roll a roll where I used a Miracle dice, such as a charge roll, can I use that dice again?", answer: "No, that Miracle dice is lost, though the unit has still performed an Act of Faith." },
  { faction: AS, source: "sororitas", question: "Triumph of Saint Katherine's Simulacrum of the Ebon Chalice: can it substitute two dice in one roll?", answer: "No." },
  { faction: AS, source: "sororitas", question: "Imagifier Litany of Deeds: can it re-roll the Miracle dice gained from Acts of Faith when a unit within 12 inches is destroyed?", answer: "Yes." },

  // === Adeptus Custodes ===
  { faction: AC, source: "custodes", question: "Auric Champions: if a leading Character dies, for example to Precision, does Assemblage of Might still apply to the rest of the unit until my next Command phase?", answer: "No." },
  { faction: AC, source: "custodes", question: "Radiant Mantle: does the -1 to hit apply if the enemy model is within 12 inches of any part of the led unit when it selects targets?", answer: "Yes." },
  { faction: AC, source: "custodesPrinted", question: "Auric Champions Superior Creation enhancement: what does it do now?", answer: "Adeptus Custodes Infantry model only, once per battle per army. At the end of a phase in which this model is destroyed, roll a D6: on a 2+ it returns as close as possible to where it died, unengaged, with 3 wounds." },
  { faction: AC, source: "custodesPrinted", question: "Does the Shield-Captain on Dawneagle Jetbike have Leader?", answer: "Yes. The update adds Leader to its Core abilities." },

  // === Space Marines ===
  { faction: "Adeptus Astartes", source: "spaceMarinesPrinted", question: "Captain Titus Righteous Fury: what does it do now?", answer: "In the Fight phase you can use it: this unit's melee attacks get +1 S. When the unit has fought, Titus heals D3 wounds, or 2D3 instead if he destroyed an enemy model this phase." },
  { faction: "Adeptus Astartes", source: "spaceMarinesPrinted", question: "When do Iron Father Feirros and a Techmarine have Lone Operative?", answer: "While within 3\" of a friendly Adeptus Astartes Vehicle unit." },
  { faction: "Adeptus Astartes", source: "spaceMarinesPrinted", question: "Are Kayvaan Shrike and the Librarian in Terminator Armour Characters?", answer: "Yes. The update adds CHARACTER to both, and EPIC HERO to Shrike too." },

  // === Adeptus Mechanicus ===
  { faction: AMEC, source: "admech", question: "Thulia Ghuld Icon of War: when do I select the affected unit?", answer: "When you've selected the Icon of War ability you want to use." },
  { faction: AMEC, source: "admech", question: "Auto-divinatory Targeting with the Protector Imperative active: what order do the Ballistic Skill changes apply?", answer: "The stratagem first sets it to 3+, then Protector improves it by 1, for 2+ with no other modifiers." },

  // === Chaos Daemons ===
  { faction: CD, source: "daemons", question: "Pink Horrors Split: can adding Blue Horrors take the unit above its starting strength?", answer: "Yes." },
  { faction: CD, source: "daemons", question: "Can a Pink or Blue Horror destroyed by its own Hazardous weapon trigger Split?", answer: "Yes." },
  { faction: CD, source: "daemons", question: "Returning models to Blue Horrors that began as Pink Horrors: can I return Pink Horrors?", answer: "No." },
  { faction: CD, source: "daemons", question: "Returning models to Blue Horrors that began as Pink Horrors: can that go above the Pink Horrors' starting strength?", answer: "No." },
  { faction: CD, source: "daemons", question: "Do Split abilities trigger on damage from something other than an attack?", answer: "No." },
  { faction: CD, source: "daemons", question: "Be'lakor The Dark Master: can he set up closer than 9 inches to enemies outside my Shadow of Chaos using Warp Rifts?", answer: "No." },
  { faction: CD, source: "daemons", question: "Greater Daemon abilities of each god: can they set up closer than 9 inches to enemies outside my Shadow of Chaos using Warp Rifts?", answer: "No." },
  { faction: CD, source: "daemons", question: "With no objectives in No Man's Land or my opponent's deployment zone, does The Shadow of Chaos cover those areas?", answer: "No." },
  { faction: CD, source: "daemons", question: "Pink Horrors with no Pink models left become Blue Horrors. What's the Blue Horrors' starting strength?", answer: "The same as the original Pink Horrors unit when added to your army list." },
  { faction: CD, source: "daemons", question: "Does Insane Bravery on a Legiones Daemonica unit count as making a battle-shock roll?", answer: "Yes, a successful one." },
  { faction: CD, source: "daemons", question: "Daemonic Pact units: are the Shadow of Chaos army rules, including Daemonic Manifestation and Daemonic Terror, in effect?", answer: "No." },

  // === Drukhari ===
  { faction: DRU, source: "drukhari", question: "Venom Aerialists: can a unit embark even if it disembarked from a transport this turn?", answer: "Yes. The ability says so itself." },

  // === Emperor's Children ===
  { faction: EC, source: "emperorsChildren", question: "Coterie of the Conceited: can I use Unbound Arrogance if my Warlord isn't on the battlefield?", answer: "Yes. Your pledge to Slaanesh goes from 0 to 1." },
  { faction: EC, source: "emperorsChildren", question: "Can Noise Marines' Terrifying Crescendo affect one enemy unit several times, stacking the subtractions?", answer: "Yes." },
  { faction: EC, source: "emperorsChildren", question: "Carnival of Excess Daemonic Empowerment: does an unmodified 5+ score a Critical Hit if the weapon already has Sustained Hits, such as Pavane of Slaanesh?", answer: "Yes." },

  // === Genestealer Cults ===
  { faction: GSC, source: "genestealerCults", question: "Brood Brothers: can Kasrkin use Warrior Elite to select an Order in my Command phase?", answer: "Yes." },
  { faction: GSC, source: "genestealerCults", question: "Can a unit using Cult Ambush without a marker be targeted with Tunnel Crawlers?", answer: "Yes." },
  { faction: GSC, source: "genestealerCults", question: "Vengeance for the Martyr!: do I need another Genestealer Cults Character on the battlefield or in Reserves?", answer: "Yes." },
  { faction: GSC, source: "genestealerCults", question: "Must unused Cult Ambush markers be removed at the end of my opponent's next Movement phase?", answer: "No." },
  { faction: GSC, source: "genestealerCults", question: "With no units in Cult Ambush, must I remove my remaining Cult Ambush markers?", answer: "No." },
  { faction: GSC, source: "genestealerCults", question: "Cult Ambush against abilities restricting Reserves, such as Omni-scramblers: must I obey them?", answer: "Yes, so for Omni-scramblers not within 12\" of that Infiltrator Squad." },

  // === Grey Knights ===
  { faction: GK, source: "greyKnights", question: "Can a unit with the Sigil of Exigence enhancement use it during my opponent's first turn?", answer: "Yes." },

  // === Agents of the Imperium ===
  { faction: AOI, source: "agents", question: "Imperialis Fleet: does a Character attached to a unit picked for Clandestine Operation or Combat Landers also gain Infiltrators or Deep Strike?", answer: "Yes." },

  // === Imperial Knights ===
  { faction: IK, source: "imperialKnights", question: "Can Adeptus Mechanicus units in the Questor Forgepact detachment use Doctrina Imperatives?", answer: "No." },

  // === Leagues of Votann ===
  { faction: LOV, source: "votann", question: "Arkanyst Evaluator Science Guild Support: does it get Lone Operative if the only other unit within 3 inches is another Arkanyst Evaluator?", answer: "No." },

  // === Thousand Sons ===
  { faction: TS, source: "thousandSons", question: "Touched by Tzeentch in Warpmeld Pact: must I declare whether the unit shoots or charges after advancing when I use the stratagem?", answer: "No, you can decide later in the turn." },
  { faction: TS, source: "thousandSons", question: "Going second, can Tzaangors put into Strategic Reserves by Ambushing Hunters arrive in my first turn with Twisted Mirage?", answer: "No." },
  { faction: TS, source: "thousandSons", question: "Can an Exalted Sorcerer on Disk of Tzeentch or a Tzaangor Shaman lead Tzaangor Enlightened with fatecaster greatbows?", answer: "Yes." },
  { faction: TS, source: "thousandSons", question: "Rubricae Phalanx Risen Rubricae: does a Character attached to the chosen unit also gain Infiltrators?", answer: "Yes." },
  { faction: TS, source: "thousandSons", question: "Cabal of Sorcerers: must I choose whether to Channel the Warp before rolling?", answer: "No." },
  { faction: TS, source: "thousandSons", question: "Cabal of Sorcerers: does a double or triple only cause D3 mortal wounds if I chose to Channel the Warp?", answer: "Yes." },
  { faction: TS, source: "thousandSons", question: "Must I sequence all my Cabal of Sorcerers Rituals at the start of my Shooting phase?", answer: "No. Pick a model with the rule, pick a Ritual and attempt it, then repeat until you run out of models or Rituals." },

  // === World Eaters ===
  { faction: WE, source: "worldEaters", question: "If Angron is destroyed and I use Reborn in Blood, can I still use Wrath of Khorne in Vessels of Wrath?", answer: "Yes." },
  { faction: WE, source: "worldEaters", question: "Khorne Daemonkin: can a Character with Disciple of Khorne be my Warlord?", answer: "No." },
  { faction: WE, source: "worldEaters", question: "Khorne Daemonkin: does a unit of Bloodcrushers or Flesh Hounds led by a Lord on Juggernaut with Disciple of Khorne get Blessings of Khorne?", answer: "Yes, even though only the Lord has that ability." },
];
