import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { HERESY_ARMY_RULES } from "../src/data/heresy-army-rules.js";
import { HERESY_CORE_RULES } from "../src/data/heresy-core-rules.js";
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

  it("lists a parent section's children", () => {
    expect(rules.find((r) => r.name === "Tactical Statuses")!.description).toContain("**Covers:**\n- Pinned");
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

  it("falls back to the rule whose text uses a term that names no rule", async () => {
    const text = await call("lookup_keyword", { keyword: "snap shots", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain('No Heresy rule is named "snap shots"');
    expect(text.toLowerCase()).toContain("snap shots");
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

  it("with no game_mode, keeps a 40K stratagem term (Overwatch) in 40K and points at both", async () => {
    const text = await call("lookup_keyword", { keyword: "Overwatch" });
    expect(text).not.toContain("Found in Horus Heresy");
    expect(text).toContain('"Fire Overwatch" stratagem');
    expect(text).toContain('game_mode "heresy"');
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
