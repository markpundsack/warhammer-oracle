import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { CORE_RULES_11E, CORE_STRATAGEM_REFS } from "../src/data/core-rules-11e.js";
import { KEYWORDS } from "../src/data/keywords.js";
import { normalizeName } from "../src/lib/search.js";

let client: Client;

async function lookup(keyword: string, game_mode?: string): Promise<string> {
  const result = await client.callTool({
    name: "lookup_keyword",
    arguments: game_mode ? { keyword, game_mode } : { keyword },
  });
  expect(result.isError).toBeFalsy();
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

describe("core rules data", () => {
  it("has a name, rule number, aliases and a summary on every rule", () => {
    for (const rule of CORE_RULES_11E) {
      expect(rule.name).toBeTruthy();
      expect(rule.ruleRef).toMatch(/^\d\d|^Universal Rules Updates$|^June PDF FAQ$/);
      expect(Array.isArray(rule.aliases)).toBe(true);
      expect(rule.summary.length).toBeGreaterThan(20);
    }
  });

  it("does not repeat a rule name, or a curated keyword's name", () => {
    const names = CORE_RULES_11E.map((r) => normalizeName(r.name));
    expect(new Set(names).size).toBe(names.length);
    for (const kw of KEYWORDS) expect(names).not.toContain(normalizeName(kw.name));
  });

  it("never gives one alias to two rules", () => {
    const owners = new Map<string, string>();
    for (const rule of CORE_RULES_11E) {
      for (const alias of rule.aliases) {
        const key = normalizeName(alias);
        expect(owners.get(key) ?? rule.name, `alias "${alias}"`).toBe(rule.name);
        owners.set(key, rule.name);
      }
    }
  });
});

describe("lookup_keyword core rules", () => {
  it("emergency disembark, with its numbers and rule reference", async () => {
    const text = await lookup("emergency disembark");
    expect(text).toContain("# Emergency Disembark Move");
    expect(text).toContain("18.05");
    expect(text).toContain("hazard roll");
    expect(text).toContain('6"');
    expect(text).toContain("battle-shocked");
    // The current app rule, which differs from the June PDF: a model is placed engaged before it's destroyed.
    expect(text).toContain("placed engaged");
  });

  it("finds emergency disembark by how people say it", async () => {
    for (const said of ["emergency disembarkation", "transport destroyed", "destroyed transport"]) {
      expect(await lookup(said), said).toContain("# Emergency Disembark Move");
    }
  });

  it("disembarking", async () => {
    const text = await lookup("disembarking");
    expect(text).toContain("# Disembarking");
    expect(text).toContain("18.03");
    expect(await lookup("get out of a transport")).toContain("# Disembarking");
  });

  it("Advance finds the move, not a stratagem", async () => {
    const text = await lookup("Advance");
    expect(text).toContain("# Advance Move");
    expect(text).toContain("09.06");
    expect(text).not.toContain("stratagem");
    expect(await lookup("Advance", "40k")).toContain("# Advance Move");
  });

  it("normal move", async () => {
    const text = await lookup("normal move");
    expect(text).toContain("# Normal Move");
    expect(text).toContain("09.05");
  });

  it("a rule number finds the rule", async () => {
    expect(await lookup("12.06")).toContain("# Overrun Fight");
  });

  it("states the rules the PDF's dice icons hide", async () => {
    const wounds = await lookup("wound roll");
    expect(wounds).toContain("05.02");
    for (const roll of ["2+", "3+", "4+", "5+", "6+"]) expect(wounds).toContain(roll);
    expect(await lookup("cover")).toContain("worsen that attack's BS by 1");
  });

  it("a value in the query still finds the rule", async () => {
    expect(await lookup("Cleave 2")).toContain("24.06");
    expect(await lookup("[FIRING DECK 2]")).toContain("24.14");
  });

  it("a keyword of the same name stays with the keyword", async () => {
    expect(await lookup("Scouts")).toContain("## Plain English");
    expect(await lookup("Hazardous")).toContain("## Plain English");
    expect(await lookup("hazard")).toContain("# Hazard Rolls");
  });

  it("follows the current app text where it differs from the June PDF", async () => {
    expect(await lookup("Hidden")).toContain("light or dense");
    expect(await lookup("objective consolidation")).toContain("unengaged");
    expect(await lookup("gone to ground")).toContain("13.11.01");
    expect(await lookup("shock disembark")).toContain("18.07");
    expect(await lookup("assault disembark")).toContain("18.06");
    expect(await lookup("dedicated transport")).toContain("destroyed");
    expect(await lookup("reserves at the end")).toContain("20.01.02");
    expect(await lookup("Damaged")).toContain("24.39");
    expect(await lookup("re-rolls")).toContain("01.05.02");
    expect(await lookup("wholly within")).toContain("01.04.01");
    expect(await lookup("incursion")).toContain("1000 points");
  });

  it("the stratagem-name fallback still answers, now with the rule number", async () => {
    const text = await lookup("Overwatch");
    expect(text).toContain("# Fire Overwatch");
    expect(text).toContain(`Core Rules ${CORE_STRATAGEM_REFS["Fire Overwatch"]}`);
  });

  it("are not offered for Kill Team", async () => {
    const text = await lookup("emergency disembark", "kill_team");
    expect(text).not.toContain("18.05");
    expect(await lookup("Waaagh!", "kill_team")).not.toContain("riled up");
  });
});

describe("lookup_keyword army rules", () => {
  it("Combat Doctrines, once, for the Adeptus Astartes rather than the Legends copies' factions", async () => {
    const text = await lookup("Combat Doctrines");
    expect(text).toContain("# Combat Doctrines");
    expect(text).toContain("Assault Doctrine");
    expect(text).toContain("Adeptus Astartes");
    expect(text).not.toContain("Chaos");
    expect(text.match(/Assault Doctrine/g)).toHaveLength(1);
  });

  it("Waaagh!, also as a transcriber spells it", async () => {
    for (const said of ["Waaagh!", "waaagh", "Waagh", "Waaaagh"]) {
      const text = await lookup(said);
      expect(text, said).toContain("# Waaagh!");
      expect(text, said).toContain("riled up");
      expect(text, said).toContain("Orks");
      expect(text, said).not.toContain("**ORKS");
    }
  });

  it("the other big army rules", async () => {
    expect(await lookup("For The Greater Good")).toContain("T'au Empire");
    expect(await lookup("Greater Good")).toContain("# For The Greater Good");
    expect(await lookup("Power from Pain")).toContain("Drukhari");
    expect(await lookup("Acts of Faith")).toContain("Adepta Sororitas");
  });

  it("says who each wording is for when the text differs", async () => {
    const text = await lookup("Narthecium");
    expect(text).toContain("worded differently");
    expect(text.length).toBeLessThan(2500);
  });

  it("removes markup a voice assistant would read aloud", async () => {
    const text = await lookup("Acts of Faith");
    expect(text).not.toContain("^^");
  });
});

describe("lookup_keyword existing behaviour", () => {
  it("an unknown term is still not found", async () => {
    const text = await lookup("Flibbertigibbet Xyzzy");
    expect(text).toContain("not found");
    expect(text).toContain("Flibbertigibbet Xyzzy");
  });

  it("curated keywords still answer", async () => {
    const text = await lookup("Lethal Hits");
    expect(text).toContain("# Lethal Hits");
    expect(text).toContain("## Plain English");
  });

  it("Heresy lookups still answer from Heresy", async () => {
    const text = await lookup("Bulky", "heresy");
    expect(text).toContain("# Bulky (X)");
    expect(await lookup("Bulky")).toContain("Found in Horus Heresy");
  });

  it("an explicit Heresy lookup is never answered from the 40K core rules", async () => {
    expect(await lookup("emergency disembark", "heresy")).not.toContain("18.05");
  });
});
