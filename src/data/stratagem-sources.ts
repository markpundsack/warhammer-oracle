/**
 * Where each faction's detachment stratagems in stratagems.ts come from, so an
 * answer can say how current it is.
 *
 * Packs were read on 2026-11-06 from GW's free downloads and compared with
 * stratagems.ts by detachment and name. Two layers remain in the data:
 * - A detachment printed in the faction's current pack ("packDetachments") is
 *   current to that pack.
 * - Any other detachment of that faction is 10th Edition Codex text (via
 *   40k.app or Wahapedia in earlier passes) with the stratagem changes from the
 *   pack's Rules Updates section applied. Wording can still be older.
 *
 * - A faction with an 11e Codex ("CODEX_SOURCES") is current to that codex for
 *   the detachments it prints. Its other detachments are older pack or 10e
 *   text and may no longer be legal.
 *
 * Pack dates per faction are the "legal for matched play" date printed in each
 * PDF. Codex release claims come from Wargamer's release list (see
 * docs/research/11e-stratagem-sources.md in the game-mode worktree): Orks 5 Sep,
 * Space Marines 3 Oct, Adeptus Custodes 17 Oct 2026.
 */
import type { Stratagem } from "../types.js";

export interface FactionPack {
  /** Faction string used in STRATAGEMS. */
  faction: string;
  /** Name as GW titles the pack, for answers. */
  packName: string;
  version: string;
  legalFrom: string;
  /** Detachments printed in full in this pack. */
  packDetachments: string[];
  /** An 11e Codex came out after this pack version, so even pack text may be stale. */
  codexSince?: string;
}

export const FACTION_PACKS: FactionPack[] = [
  { faction: "Tyranids", packName: "Tyranids", version: "1.3", legalFrom: "14 Oct 2026", packDetachments: ["Ambush Predators", "Talons of the Norn Queen", "Warrior Bioform Onslaught", "Subterranean Assault"] },
  { faction: "Necrons", packName: "Necrons", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Hand of the Dynasty", "Skyshroud Spearhead", "The Phaeron's Armoury", "Starshatter Arsenal", "Cryptek Conclave", "Cursed Legion", "Pantheon of Woe"] },
  { faction: "T'au Empire", packName: "T'au Empire", version: "1.2", legalFrom: "26 Aug 2026", packDetachments: ["Advanced Acquisition Cadre", "Auxiliary Cadre", "Experimental Prototype Cadre"] },
  { faction: "Death Guard", packName: "Death Guard", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Contagion Engines", "Flyblown Host", "Paragons of Putrescence"] },
  { faction: "Heretic Astartes", packName: "Chaos Space Marines", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Cabal of Chaos", "Devotees of Destruction", "Murdertalon Raiders", "Warpstrike Champions", "Cult of the Arkifane", "Creations of Bile", "Nightmare Hunt", "Huron's Marauders", "Renegade Warband"] },
  { faction: "Astra Militarum", packName: "Astra Militarum", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Abhuman Auxiliaries", "Bridgehead Strike", "Designation Force", "Steel Hammer", "Armoured Infantry", "Grizzled Company"] },
  { faction: "Aeldari", packName: "Aeldari", version: "1.4", legalFrom: "14 Oct 2026", packDetachments: ["Armoured Warhost", "Fateful Performance", "Path of the Outcast", "Twilight Flickers", "Serpent's Brood", "Eldritch Raiders", "Corsair Coterie"] },
  { faction: "Adepta Sororitas", packName: "Adepta Sororitas", version: "1.4", legalFrom: "14 Oct 2026", packDetachments: ["Chorus of Condemnation", "Sacred Champions", "Champions of Faith"] },
  { faction: "Adeptus Custodes", packName: "Adeptus Custodes", version: "1.2", legalFrom: "30 Sep 2026", packDetachments: ["Might of the Moritoi", "Silent Hunters", "Tharanatoi Hammerblow", "Lions of the Emperor", "Solar Spearhead"], codexSince: "October 2026" },
  { faction: "Adeptus Mechanicus", packName: "Adeptus Mechanicus", version: "1.4", legalFrom: "14 Oct 2026", packDetachments: ["Cohort Acquisitus", "Lords of the Forge", "Luminen Auto-choir", "Eradication Cohort", "Haloscreed Battle Clade"] },
  { faction: "Legiones Daemonica", packName: "Chaos Daemons", version: "1.2", legalFrom: "30 Sep 2026", packDetachments: ["Daemonic Incursion", "Shadow Legion", "Cavalcade of Chaos", "Lords of the Warp", "Warptide", "Blood Legion", "Scintillating Legion", "Plague Legion", "Legion of Excess"] },
  { faction: "Chaos Knights", packName: "Chaos Knights", version: "1.2", legalFrom: "26 Aug 2026", packDetachments: ["Bastions of Tyranny", "Hunting Warpack", "Iconoclast Fiefdom", "Helhunt Lance"] },
  { faction: "Drukhari", packName: "Drukhari", version: "1.2", legalFrom: "26 Aug 2026", packDetachments: ["Exhibition of Slaughter", "Kabalite Agonysts", "Tools of Torment", "Reaper's Wager"] },
  { faction: "Emperor's Children", packName: "Emperor's Children", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Elegant Brutes", "Frenzied Host", "Spectacle of Slaughter", "Court of the Phoenician"] },
  { faction: "Genestealer Cults", packName: "Genestealer Cults", version: "1.1", legalFrom: "22 Jul 2026", packDetachments: ["Heroes of the Uprising", "Purestrain Broodswarm", "Xenocult Masses", "Final Day"] },
  { faction: "Grey Knights", packName: "Grey Knights", version: "1.2", legalFrom: "30 Sep 2026", packDetachments: ["Argent Assault", "Fires of Purgation", "Immaterial Interdiction", "Warpbane Task Force"] },
  { faction: "Agents of the Imperium", packName: "Imperial Agents", version: "1.3", legalFrom: "14 Oct 2026", packDetachments: ["Veiled Blade Elimination Force"] },
  { faction: "Imperial Knights", packName: "Imperial Knights", version: "1.2", legalFrom: "26 Aug 2026", packDetachments: ["Dominus Foebreakers", "Questor Forgepact", "Throne-bonded Outriders", "Freeblade Company"] },
  { faction: "Leagues of Votann", packName: "Leagues of Votann", version: "1.2", legalFrom: "14 Oct 2026", packDetachments: ["Armoured Trailblazers", "Farseekers", "Hearthguard Covenant", "Hearthband", "Mercenary Oathband"] },
  { faction: "Thousand Sons", packName: "Thousand Sons", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Ritual of Regeneration", "Sekhetar Cohort", "Servants of Change", "Hexwarp Thrallband"] },
  { faction: "World Eaters", packName: "World Eaters", version: "1.3", legalFrom: "30 Sep 2026", packDetachments: ["Brazen Engines", "Butchers of Khorne", "Vessels of Wrath"] },
];

/** A faction whose 11e Codex replaced its pack, read from the pages Mark saved. */
export interface CodexSource {
  /** Faction string used in STRATAGEMS. */
  faction: string;
  /** Name as the codex is titled, for answers. */
  codexName: string;
  /** When Mark saved the codex pages (Wahapedia, codex app data October 2026). */
  savedOn: string;
  /** What the saved pages leave out, if anything, for the "not in the codex" note. */
  scope?: string;
  /** Matched-play detachments printed in the codex (Boarding Actions ones excluded). */
  detachments: string[];
  /** Codex detachments that print no stratagems at all. */
  noStratagems?: string[];
}

export const CODEX_SOURCES: CodexSource[] = [
  {
    faction: "Orks",
    codexName: "Orks",
    savedOn: "8 Nov 2026",
    detachments: [
      "War Horde", "Green Tide", "Bully Boyz", "Runt Swarm", "Shoota Boyz", "Taktikal Brigade", "Wreckas",
      "Da Big Hunt", "Madcap Meks", "Dread Mob", "Blitz Brigade", "Kult of Speed", "Flyboyz", "Brute Bosses", "Wurrband",
    ],
    noStratagems: ["Brute Bosses", "Wurrband"],
  },
  {
    faction: "Adeptus Astartes",
    codexName: "Space Marines",
    savedOn: "8 Nov 2026",
    scope: "which leave out the Chapter supplements",
    detachments: [
      "Gladius Task Force", "Assault Brethren", "Tactical Brethren", "Devastator Brethren", "Terminator Storm Force",
      "Tacticus Attack Force", "Tacticus Firestorm Force", "Phobos Shadow Force", "Phobos Shock Force",
      "Gravis Linebreaker Force", "Gravis Siege Force", "Stormlance Task Force", "Ironclad Champions",
      "Gauntlet Task Force", "Ironstorm Spearhead", "Deathwatch Support",
    ],
  },
];

/** Factions with no current non-Legends pack: their text was not re-synced. */
export const FACTIONS_WITHOUT_CURRENT_PACK: Record<string, string> = {
  "Black Templars": "GW no longer lists a Black Templars pack, so this is June 2026 pack or 10th Edition Codex text",
  Deathwatch: "GW no longer lists a Deathwatch pack, so this is June 2026 pack text",
  "Blood Angels": "GW's current Blood Angels pack holds only Legends datasheets, so this is June 2026 pack or 10th Edition Codex text",
  "Dark Angels": "GW's current Dark Angels pack holds only Legends datasheets, so this is June 2026 pack or 10th Edition Codex text",
  "Space Wolves": "GW's current Space Wolves pack holds only Legends datasheets, so this is June 2026 pack or 10th Edition Codex text",
};

/**
 * Names BSData (detachments-11e.ts) uses where stratagems.ts and GW's packs use
 * another, lower-cased. Without these the detachment looks like it has no stratagems.
 */
const DETACHMENT_ALIASES: Record<string, string> = {
  "brood brother auxilia": "Brood Brothers Auxilia",
  "ordo xenos alien hunters": "Alien Hunters (Ordo Xenos)",
  "ordo hereticus purgation force": "Purgation Force (Ordo Hereticus)",
  "ordo malleus daemon hunters": "Daemon Hunters (Ordo Malleus)",
};

/** Compare detachment names ignoring case, spacing and apostrophe style. */
export function detachmentKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The codex that prints this detachment without any stratagems, if one does. */
export function codexDetachmentWithoutStratagems(detachment: string): CodexSource | undefined {
  const k = detachmentKey(detachment);
  return CODEX_SOURCES.find((c) => c.noStratagems?.some((d) => detachmentKey(d) === k));
}

/** The detachment name stratagems.ts uses for a detachment name from anywhere else. */
export function stratagemDetachmentName(name: string): string {
  return DETACHMENT_ALIASES[name.trim().toLowerCase()] ?? name;
}

const FACTION_ALIASES: Record<string, string> = {
  "chaos space marines": "Heretic Astartes",
  csm: "Heretic Astartes",
  "chaos daemons": "Legiones Daemonica",
  daemons: "Legiones Daemonica",
  "space marines": "Adeptus Astartes",
  "imperial agents": "Agents of the Imperium",
  sisters: "Adepta Sororitas",
  "sisters of battle": "Adepta Sororitas",
  admech: "Adeptus Mechanicus",
  votann: "Leagues of Votann",
  custodes: "Adeptus Custodes",
  tau: "T'au Empire",
};

/** The STRATAGEMS faction label for what a player calls their army. */
export function stratagemFactionLabel(faction: string): string {
  const key = faction.trim().toLowerCase().replace(/[’]/g, "'");
  if (FACTION_ALIASES[key]) return FACTION_ALIASES[key];
  const pack = FACTION_PACKS.find((p) => p.faction.toLowerCase() === key || p.packName.toLowerCase() === key);
  return pack?.faction ?? faction.trim();
}

export interface StratagemProvenance {
  /** True when the player should be warned that this text may be out of date. */
  older: boolean;
  /** One line for a stratagem or detachment answer. */
  note: string;
  /** A few words for one line of a list. */
  short: string;
}

/** How current one stratagem's text is. */
export function stratagemProvenance(s: Pick<Stratagem, "faction" | "detachment">): StratagemProvenance {
  if (s.faction === "Core" || !s.detachment) {
    return { older: false, note: "Reflects the Warhammer 40,000 11th Edition Core Rules.", short: "core rules" };
  }
  const codex = CODEX_SOURCES.find((c) => c.faction === s.faction);
  if (codex) {
    const ref = `the 11th edition ${codex.codexName} codex`;
    if (codex.detachments.some((d) => detachmentKey(d) === detachmentKey(s.detachment!))) {
      return {
        older: false,
        note: `Current to ${ref}, via Mark's saved pages (${codex.savedOn}).`,
        short: `11e codex, ${codex.savedOn}`,
      };
    }
    const pages = codex.scope ? `Mark's saved pages, ${codex.savedOn}, ${codex.scope}` : `Mark's saved pages, ${codex.savedOn}`;
    return {
      older: true,
      note: `Older text: ${s.detachment} isn't in ${ref} (${pages}), so this is earlier pack or 10th Edition text and the detachment may no longer be legal. Warn the player and suggest checking the app.`,
      short: "older: not in the 11e codex",
    };
  }
  const missing = FACTIONS_WITHOUT_CURRENT_PACK[s.faction];
  if (missing) {
    return { older: true, note: `Older text: ${missing}. Warn the player and suggest checking the app.`, short: "older text, not current" };
  }
  const pack = FACTION_PACKS.find((p) => p.faction === s.faction);
  if (!pack) {
    return { older: true, note: "Older text: source not recorded. Warn the player and suggest checking the app.", short: "older text, not current" };
  }
  const packRef = `${pack.packName} Faction Pack v${pack.version} (legal from ${pack.legalFrom})`;
  if (pack.packDetachments.includes(s.detachment)) {
    if (pack.codexSince) {
      return {
        older: true,
        note: `From the ${packRef}. An 11e Codex came out in ${pack.codexSince}, so warn the player this may have changed.`,
        short: `pack v${pack.version}, Codex since released`,
      };
    }
    return { older: false, note: `Current to the ${packRef}.`, short: `pack v${pack.version}, ${pack.legalFrom}` };
  }
  return {
    older: true,
    note: `Older text: 10th Edition Codex wording with the ${packRef} updates applied, so warn the player the wording may be out of date and suggest checking the app.`,
    short: `older: 10e Codex text, pack v${pack.version} updates applied`,
  };
}
