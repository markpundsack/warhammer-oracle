import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { HERESY_ARMY_RULES } from "../src/data/heresy-army-rules.js";
import { HERESY_CORE_RULES } from "../src/data/heresy-core-rules.js";
import { HERESY_FAQ } from "../src/data/heresy-faq.js";
import { searchHeresyFaq } from "../src/lib/heresy-faq.js";
import { HERESY_PROFILE_RULES } from "../src/data/heresy-profile-rules.js";
import { PHASES_HERESY } from "../src/data/phases-heresy.js";
import { splitSections, sectionsToRules } from "../scripts/fetch-heresy-core-rules.js";

let client: Client;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

const HERESY_STAMP = "[Mode: Horus Heresy (3rd edition)]";

describe("Heresy rules data", () => {
  it("has the profile-based rules from BSData", () => {
    const kinds = new Set(HERESY_PROFILE_RULES.map((r) => r.kind));
    for (const k of ["reaction", "gambit", "psychic power", "psychic reaction", "wargear", "asset", "detachment"]) {
      expect(kinds.has(k as never), k).toBe(true);
    }
    expect(HERESY_PROFILE_RULES.filter((r) => r.kind === "reaction").length).toBeGreaterThan(50);
    expect(HERESY_PROFILE_RULES.filter((r) => r.kind === "gambit").length).toBeGreaterThan(40);
    const primary = HERESY_PROFILE_RULES.find((r) => r.name === "Crusade Primary Detachment");
    expect(primary?.description).toContain("- 4 Troops (1 Prime)");
  });

  it("has the core rules: statuses, core Reactions and Gambits, phases, missions", () => {
    const names = new Set(HERESY_CORE_RULES.map((r) => r.name));
    for (const n of ["Pinned", "Suppressed", "Stunned", "Routed", "Movement Phase: Reposition", "Shooting Phase: Return Fire",
      "Assault Phase: Overwatch", "Flurry of Blows", "Seize the Initiative", "Charge Sub-Phase", "Core Mission Primary Objectives"]) {
      expect(names.has(n), n).toBe(true);
    }
    for (const r of HERESY_CORE_RULES) {
      expect(r.url).toMatch(/^https:\/\/wahapedia\.ru\/heresy3\/the-rules\//);
      expect(r.description).not.toMatch(/[\u0001-\u0003]/); // tokenizer markers never leak
    }
    // Trigger / Cost / Target are separate paragraphs, not run together with the summary
    const reposition = HERESY_CORE_RULES.find((r) => r.name === "Movement Phase: Reposition")!;
    expect(reposition.summary).not.toContain("Trigger");
    expect(reposition.description).toMatch(/\n\n\*\*Cost:\*\* /);
  });

  it("prints a table once, one row per line (no narrow-screen duplicate)", () => {
    const d = HERESY_CORE_RULES.find((r) => r.name === "Ranged Hit Tests")!.description;
    expect(d).toContain("**BS** | **10+** | **9** | **8** | **7** | **6** | **5** | **4** | **3** | **2** | **1**");
    expect(d.match(/\*\*Target Number\*\*/g)).toHaveLength(1);
  });

  it("nests every sub-phase under its phase (incl. the Challenge Sub-Phase)", () => {
    const assault = PHASES_HERESY.find((p) => p.name === "Assault")!;
    expect(assault.steps.map((s) => s.split(":")[0])).toEqual([
      "Charge Sub-Phase",
      "Challenge Sub-Phase",
      "Fight Sub-Phase",
      "Resolution Sub-Phase",
    ]);
    expect(PHASES_HERESY.map((p) => p.name)).toEqual(["Start", "Movement", "Shooting", "Assault", "End"]);
    for (const p of PHASES_HERESY) expect(p.steps.length, p.name).toBeGreaterThan(0);
  });
});

describe("fetch-heresy-core-rules HTML parsing", () => {
  const html =
    '<body><a name="Tactical-Statuses"></a><h2 id="Tactical-Statuses">Tactical Statuses</h2>Intro.' +
    '<div class="tooltip_templates"><span>glossary text</span></div>' +
    '<a name="Pinned"></a><h4 id="Pinned">Pinned</h4><b>Summary line.</b><br><br><b>Trigger:</b> when shot.<b>Cost:</b> 1 point.' +
    '<p class="ShowFluff legend2">Flavour.</p><ul><li>one</li><li>two</li></ul>' +
    '<table><tr><td>1-2</td><td>A</td></tr><tr><td>3-4</td><td>B</td></tr></table></body>';
  const rules = sectionsToRules("principles-of-combat", "Principles of Combat", splitSections(html));

  it("drops tooltips and flavour, keeps lists and table rows, separates bold labels", () => {
    const pinned = rules.find((r) => r.name === "Pinned")!;
    expect(pinned.kind).toBe("status");
    expect(pinned.summary).toBe("Summary line.");
    expect(pinned.description).not.toContain("glossary");
    expect(pinned.description).not.toContain("Flavour");
    expect(pinned.description).toContain("**Trigger:** when shot.\n\n**Cost:** 1 point.");
    expect(pinned.description).toContain("- one\n- two");
    expect(pinned.description).toMatch(/1-2 \| A\n+3-4 \| B/);
    expect(pinned.context).toBe("Principles of Combat > Tactical Statuses");
  });

  it("a parent section carries a short child's text", () => {
    const d = rules.find((r) => r.name === "Tactical Statuses")!.description;
    expect(d).toContain("### Pinned");
    expect(d).toContain("Summary line.");
  });
});

describe("lookup_keyword with game_mode heresy (rules beyond special rules)", () => {
  it("answers a core Reaction by its short name", async () => {
    const text = await call("lookup_keyword", { keyword: "Return Fire", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("# Shooting Phase: Return Fire");
    expect(text).toContain("**Type:** Reaction");
    expect(text).toContain("Reaction Allotment");
    expect(text).toContain("https://wahapedia.ru/heresy3/the-rules/principles-of-combat/#");
  });

  it("answers a Status", async () => {
    const text = await call("lookup_keyword", { keyword: "Pinned", game_mode: "heresy" });
    expect(text).toContain("# Pinned");
    expect(text).toContain("**Type:** Status");
  });

  it("answers a core Gambit and a Legion Gambit", async () => {
    expect(await call("lookup_keyword", { keyword: "Flurry of Blows", game_mode: "heresy" })).toContain("**Type:** Gambit");
    const legion = await call("lookup_keyword", { keyword: "Paragon of Excellence", game_mode: "heresy" });
    expect(legion).toContain("**Type:** Gambit — from Legiones Astartes Emperor's Children");
  });

  it("answers a detachment from the force organisation chart", async () => {
    const text = await call("lookup_keyword", { keyword: "Crusade Primary Detachment", game_mode: "heresy" });
    expect(text).toContain("**Type:** Detachment");
    expect(text).toContain("1 High Command");
  });

  it("answers a mission rule and a deployment map", async () => {
    expect(await call("lookup_keyword", { keyword: "Hammer and Anvil", game_mode: "heresy" })).toContain("**Type:** Mission Rule");
    expect(await call("lookup_keyword", { keyword: "Seize the Initiative", game_mode: "heresy" })).toContain(HERESY_STAMP);
  });

  it("finds a section by the words players use, not only its name", async () => {
    const text = await call("lookup_keyword", { keyword: "glancing hits", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("# Armour Penetration Test");
    expect(text).toContain('No Heresy rule is named "glancing hits"');
    expect(text).toContain("_Other Horus Heresy rules that may cover");
  });

  it("answers what players actually asked (2026-11-13 game) and their usual variants", async () => {
    const cases: [string, string][] = [
      ["Snap Shots", "# Snap Shots"],
      ["snapshot", "# Snap Shots"],
      ["Volley Fire", "# 4. Make Volley Attacks"],
      ["volly fire", "# 4. Make Volley Attacks"],
      ["Return Fire", "# Shooting Phase: Return Fire"],
      ["over watch", "# Assault Phase: Overwatch"],
      ["advance", "# Rush"],
      ["hull points", "# Damage Characteristics"],
      ["reaction points", "# Reaction Allotments"],
      ["titan locations", "# Targeting a Titan"],
      ["tank shock", "# Moving Through Other Units"],
      ["sweeping advance", "# Aftermath Options"],
    ];
    for (const [kw, want] of cases) {
      expect(await call("lookup_keyword", { keyword: kw, game_mode: "heresy" }), kw).toContain(want);
    }
  });

  it("prefers the core rule over one army list's copy of a generic name", async () => {
    const text = await call("lookup_keyword", { keyword: "Deploy Objectives", game_mode: "heresy" });
    expect(text).toContain("Battles in the Age of Darkness");
  });

  it("still prefers the special rule over a same-named section", async () => {
    const text = await call("lookup_keyword", { keyword: "Deep Strike", game_mode: "heresy" });
    expect(text).not.toContain("**Type:**");
  });

  it("with no game_mode, answers a Heresy-only Reaction from Heresy", async () => {
    const text = await call("lookup_keyword", { keyword: "Return Fire" });
    expect(text).toContain("Found in Horus Heresy");
    expect(text).toContain("# Shooting Phase: Return Fire");
  });

  it("with no game_mode, a 40K stratagem term (Overwatch) answers with the stratagem itself, not a pointer", async () => {
    const text = await call("lookup_keyword", { keyword: "Overwatch" });
    expect(text).not.toContain("Found in Horus Heresy");
    expect(text).toContain("# Fire Overwatch");
    expect(text).toContain("**When:**");
    expect(text).toContain("Horus Heresy also has");
  });

  it("game_mode 40k for a Heresy-only rule answers with the rule, labelled (a pointer gets read aloud)", async () => {
    const text = await call("lookup_keyword", { keyword: "Crusade Primary Detachment", game_mode: "40k" });
    expect(text).toContain("_Found in Horus Heresy, not 40K.");
    expect(text).toContain("1 High Command");
  });

  it("\"Reaction Allotment\" answers with the numbers, not just the concept", async () => {
    const text = await call("lookup_keyword", { keyword: "Reaction Allotment", game_mode: "heresy" });
    expect(text).toContain("Base Reaction Allotment of 1");
    expect(text).toContain("1,501 - 3,500 Points | +1 Reaction Point");
  });

  it("\"Reactions\" carries the Reaction Allotment bonus table", async () => {
    const text = await call("lookup_keyword", { keyword: "Reactions", game_mode: "heresy" });
    expect(text).toContain("1,501 - 3,500 Points | +1 Reaction Point");
  });

  it("does not pull a generic 40K question over to Heresy core rules when no game_mode is given", async () => {
    const text = await call("lookup_keyword", { keyword: "Line of Sight" });
    expect(text).not.toContain("Found in Horus Heresy");
  });
});

describe("Heresy army list rules (Wahapedia faction pages)", () => {
  it("has every Legion's Rite of War and Solar Auxilia's Cohort Doctrines", () => {
    const rites = HERESY_ARMY_RULES.filter((r) => r.kind === "rite of war").map((r) => r.name);
    expect(rites.length).toBeGreaterThanOrEqual(18);
    expect(rites).toContain("Rite of War: Legiones Astartes Night Lords");
    expect(HERESY_ARMY_RULES.some((r) => r.name === "Cohort Doctrine: Solar Pattern Cohort")).toBe(true);
  });

  it("keeps answers voice-sized and skips the duplicated Special Rules dump", () => {
    for (const r of HERESY_ARMY_RULES) expect(r.description.length, r.name).toBeLessThanOrEqual(8200);
    expect(HERESY_ARMY_RULES.some((r) => r.name === "Special Rules")).toBe(false);
  });

  it("lookup_keyword finds a Rite of War by the name players say", async () => {
    const text = await call("lookup_keyword", { keyword: "Night Lords Rite of War", game_mode: "heresy" });
    expect(text).toContain("# Rite of War: Legiones Astartes Night Lords");
    expect(text).toContain("**Type:** Rite of War");
    expect(text).toContain("A Talent for Murder");
  });

  it("lookup_keyword answers a Legion detachment with its slots (BSData) over Wahapedia's image-only entry", async () => {
    const text = await call("lookup_keyword", { keyword: "Deathwing Conclave", game_mode: "heresy" });
    expect(text).toContain("# Auxiliary - Deathwing Conclave");
    expect(text).toContain("1 Retinue (1 Prime)");
  });
});

describe("lookup_phase / game_flow with game_mode heresy", () => {
  it("lookup_phase returns the Heresy Assault Phase with its sub-phases and Core Reaction", async () => {
    const text = await call("lookup_phase", { phase_name: "Assault", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("# Assault Phase");
    expect(text).toContain("Challenge Sub-Phase");
    expect(text).toContain("Overwatch");
    expect(text).not.toContain("11th Edition");
  });

  it("game_flow lists the five Heresy phases", async () => {
    const text = await call("game_flow", { game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    for (const p of ["Start", "Movement", "Shooting", "Assault", "End"]) expect(text).toContain(`${p} Phase`);
    expect(text).not.toContain("11th Edition");
  });
});

describe("Heresy units named by a model, and compare_units with game_mode heresy", () => {
  it("lookup_unit finds the unit fielding a named model (Legionaries → Tactical Squad)", async () => {
    const text = await call("lookup_unit", { unit_name: "Legionaries", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain('"Legionaries" is a model, not a unit: the Legionary in the Tactical Squad datasheet');
    expect(text).toContain("# Tactical Squad");
  });

  it("a unit name still beats a model name", async () => {
    const text = await call("lookup_unit", { unit_name: "Tactical Squad", game_mode: "heresy" });
    expect(text).not.toContain("is a model, not a unit");
  });

  it("with no game_mode, a 40K unit of that name still wins", async () => {
    const text = await call("lookup_unit", { unit_name: "Legionaries" });
    expect(text.startsWith("[Mode: 40k 11e]")).toBe(true);
  });

  it("compares two Terminator squads in one stat table", async () => {
    const text = await call("compare_units", { units: ["Cataphractii Terminator Squad", "Tartaros Terminator Squad"], game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("# Horus Heresy Unit Comparison (2 units)");
    expect(text).toContain("| Unit | Model | Type | M | WS | BS | S | T | W | I | A | LD | CL | WP | IN | SAV | INV |");
    expect(text).toMatch(/\| Cataphractii Terminator Squad \| Cataphractii Terminator \|.*\| 4\+ \|/);
    expect(text).toMatch(/\| Tartaros Terminator Squad \| Tartaros Terminator \|.*\| 5\+ \|/);
    expect(text).not.toContain("| OC |"); // never 40K headers
  });

  it("resolves a model name, notes a miss, and shows a duplicate once", async () => {
    const text = await call("compare_units", { units: ["Legionaries", "Tactical Squad", "Qqq Fake Unit"], game_mode: "heresy" });
    expect(text).toContain("**Units not found:**");
    expect(text).toContain("matched Tactical Squad again");
    expect(text).toMatch(/# Horus Heresy Unit Comparison \(1 unit\)$/m);
  });

  it("compares a vehicle with its armour profile", async () => {
    const text = await call("compare_units", { units: ["Sicaran Battle Tank", "Predator"], game_mode: "heresy" });
    expect(text).toContain("### Armoured Profiles — Sicaran");
  });
});

describe("Heresy FAQ", () => {
  it("has the core FAQ and the army list FAQ rulings, cleanly split", () => {
    expect(HERESY_FAQ.length).toBeGreaterThanOrEqual(45);
    expect(HERESY_FAQ.some((e) => e.source === "Legiones Astartes FAQ")).toBe(true);
    for (const e of HERESY_FAQ) {
      expect(e.question).not.toMatch(/\bQ:|\bA:|\|/);
      expect(e.answer).not.toMatch(/\bQ:|\|/);
    }
  });

  it("finds a ruling from the player's own words, and nothing for an unrelated question", () => {
    expect(searchHeresyFaq("can vehicles be locked in combat")[0].entry.question).toMatch(/^Vehicles ‘cannot be locked in combat’/);
    expect(searchHeresyFaq("does orbital assault vehicle count towards the deep strike limit")[0].entry.answer).toBe("Yes.");
    expect(searchHeresyFaq("how much does a lascannon cost")).toEqual([]);
  });

  it("heresy_faq answers with the ruling and its source", async () => {
    const text = await call("heresy_faq", { question: "Do gambits work outside of challenges?" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("**A:** No, the effects of a Gambit");
    expect(text).toContain("Horus Heresy FAQ — https://wahapedia.ru/heresy3/the-rules/faq/");
  });

  it("finds Volley Attacks by what players say ('volley fire')", async () => {
    const text = await call("lookup_keyword", { keyword: "Volley Fire", game_mode: "heresy" });
    expect(text).toContain("# 4. Make Volley Attacks");
    expect(text).toContain("all attacks are made as Snap Shots");
  });

  it("lookup_keyword appends FAQ rulings that name the rule", async () => {
    const text = await call("lookup_keyword", { keyword: "Vanguard", game_mode: "heresy" });
    expect(text).toContain("## Official clarifications");
  });
});

describe("Heresy attack calculator from names", () => {
  it("looks up weapon and target: ten bolter shots at Legionaries", async () => {
    const text = await call("heresy_attack_calculator", { weapon: "bolter", target: "Legionaries", attacks: 10 });
    expect(text).toContain("**Answer:** About 1 model killed.");
    expect(text).toContain("assuming BS 4");
    expect(text).toContain("T4, W1, SAV 3+");
  });

  it("a two-profile weapon answers per profile, matching the hand-worked 3.7 damage", async () => {
    const text = await call("heresy_attack_calculator", { weapon: "Adrastus bolt caliver", target: "Legionaries", attacks: 10 });
    expect(text).toContain("**Answer, by weapon profile:**");
    expect(text).toMatch(/Bolt volley \(Primary\):\*\* .*about 3\.7 points of damage/);
  });

  it("speaks a single shot at a vehicle as a percentage, picking up Armourbane from the weapon", async () => {
    const text = await call("heresy_attack_calculator", { weapon: "lascannon", target: "Rhino" });
    expect(text).toContain("**Answer:** A 44% chance of a Penetrating Hit, and no Glancing Hits.");
  });

  it("uses a named attacker's characteristics and the melee Strength modifier", async () => {
    const text = await call("heresy_attack_calculator", { weapon: "power fist", target: "Legionaries", attacker: "Centurion" });
    expect(text).toContain("S8 vs T4");
    expect(text).not.toContain("assuming");
  });

  it("says so when a name isn't found, and still takes plain numbers", async () => {
    expect(await call("heresy_attack_calculator", { weapon: "Nonsense Gun", target: "Legionaries" })).toContain('No Horus Heresy weapon found matching "Nonsense Gun"');
    const text = await call("heresy_attack_calculator", { attack_type: "ranged", attacks: 10, ballistic_skill: 4, strength: 4, toughness: 4, ap: 5, damage: "1", armour_save: 3 });
    expect(text).toContain("3+ → **6.67 hits**");
  });
});

describe("no-game_mode unit names across games", () => {
  it("an exact Heresy name beats a prefix of Legends-only 40K datasheets", async () => {
    const text = await call("lookup_unit", { unit_name: "Sicaran" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("40K only has Legends datasheets");
  });

  it("a prefix of a current 40K unit stays 40K", async () => {
    expect((await call("lookup_unit", { unit_name: "Leman Russ" })).startsWith("[Mode: 40k 11e]")).toBe(true);
    expect((await call("lookup_unit", { unit_name: "Rogal Dorn" })).startsWith("[Mode: 40k 11e]")).toBe(true);
  });

  it("a Kill Team team name lists the team", async () => {
    const text = await call("lookup_unit", { unit_name: "Gellerpox Infected", game_mode: "kill_team" });
    expect(text).toContain("A Kill Team kill team");
    expect(text).toContain("Vulgrar Thrice-cursed");
  });
});
