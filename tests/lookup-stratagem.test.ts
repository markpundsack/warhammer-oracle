import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

let client: Client;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

describe("lookup_stratagem", () => {
  it("is registered", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "lookup_stratagem")).toBeDefined();
  });

  it("finds a core stratagem by name", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Command Re-roll" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Command Re-Roll");
    expect(text).toContain("1");
    expect(text).toContain("Warhammer 40,000");
  });

  it("always includes game mode label", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Fire Overwatch" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Warhammer 40,000");
  });

  it("filters by faction", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Honour the Chapter", faction: "Adeptus Astartes" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Honour the Chapter");
    expect(text).toContain("Adeptus Astartes");
  });

  it("suggests lookup_ploy for not found", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "xyznonexistent" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("lookup_ploy");
  });

  it("asks for disambiguation when an exact name collides across factions", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Spiteful Demise" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Multiple stratagems named");
    expect(text).toContain("Legiones Daemonica");
    expect(text).toContain("Chaos Knights");
  });

  it("resolves a name collision when disambiguated by faction", async () => {
    const result = await client.callTool({
      name: "lookup_stratagem",
      arguments: { name: "Spiteful Demise", faction: "Chaos Knights" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Spiteful Demise");
    expect(text).toContain("Chaos Knights");
    expect(text).not.toContain("Multiple stratagems named");
  });

  async function lookup(args: Record<string, string>): Promise<string> {
    const result = await client.callTool({ name: "lookup_stratagem", arguments: args });
    return (result.content as Array<{ type: string; text: string }>)[0].text;
  }

  it("says a pack stratagem is current, naming pack version and date", async () => {
    const text = await lookup({ name: "Scanner Gheist" });
    expect(text).toContain("Current to the Tyranids Faction Pack v1.3 (legal from 14 Oct 2026)");
  });

  it("warns on 10e Codex text, naming the pack updates applied", async () => {
    const text = await lookup({ name: "Reinforced Hive Node" });
    expect(text).toContain("Older text: 10th Edition Codex wording");
    expect(text).toContain("Tyranids Faction Pack v1.3");
  });

  it("warns on factions with no current pack", async () => {
    const text = await lookup({ name: "Blade of Detestation" });
    expect(text).toContain("no longer lists a Black Templars pack");
  });

  it.each([
    ["From Beyond the Veil", "**CP:** 2"],
    ["Adamantine Behemoth", "**CP:** 2"],
    ["Infernal Fusillade", "**CP:** 1"],
    ["Rapturous Agony", "Strength above its Toughness"],
    ["Crawling Horror", '-6" detection range'],
    ["Tanglestrike Rounds", '-2" M'],
    ["Insanity's Ire", 'surge move of up to D6"'],
  ])("%s reflects the current pack", async (name, expected) => {
    expect(await lookup({ name })).toContain(expected);
  });

  it("no longer has the replaced Thieves of Pain", async () => {
    expect(await lookup({ name: "Thieves of Pain", faction: "Legiones Daemonica", detachment: "Legion of Excess" })).toContain("No Warhammer 40,000 stratagem found");
  });
});
