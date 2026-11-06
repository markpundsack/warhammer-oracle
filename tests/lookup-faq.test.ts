import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { FAQ_11E, FAQ_SOURCES } from "../src/data/faq-11e.js";
import { searchFaq11e } from "../src/lib/faq-11e.js";

let client: Client;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

async function ask(question: string, faction?: string): Promise<string> {
  const result = await client.callTool({ name: "lookup_faq", arguments: { question, faction } });
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

describe("lookup_faq", () => {
  it("every ruling has text and a known source", () => {
    expect(FAQ_11E.length).toBeGreaterThanOrEqual(120);
    for (const e of FAQ_11E) {
      expect(e.question.length).toBeGreaterThan(5);
      expect(e.answer.length).toBeGreaterThan(1);
      expect(FAQ_SOURCES[e.source].url).toMatch(/^https:/);
    }
  });

  it.each([
    ["Is a free stratagem really free if the rule doesn't name it?", "takes 1CP off"],
    ["Can a stratagem stop my unit being shot from more than 12 inches?", "18"],
    ["How often can I use a stratagem that adds a new unit identical to a destroyed unit?", "Once per battle"],
    ["What move does my unit use to disembark from a transport that advanced?", "shock disembark"],
    ["Does the 15VP limit apply to VP scored at the end of the battle?", "don't count"],
    ["My Beacon unit died, can I select a new Beacon unit?", "No, so that mission"],
    ["What does underlined one mean on a card?", "Exactly one"],
    ["Is there a limit on extra CP per battle round at an event?", "at most 1CP"],
    ["Can I use Insane Bravery against Shadow in the Warp?", "your own Command phase"],
    ["Can a Dark Pact be made with Fire Overwatch?", "selected to shoot"],
  ])("answers %s", async (question, expected) => {
    expect(await ask(question)).toContain(expected);
  });

  it("names the source", async () => {
    const text = await ask("Is a free stratagem really free if the rule doesn't name it?");
    expect(text).toContain("Universal Rules Updates v1.1");
  });

  it("limits to the army's rulings plus universal ones", () => {
    const hits = searchFaq11e("Insane Bravery battle-shock roll", "Chaos Daemons");
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect([undefined, "Legiones Daemonica"]).toContain(h.entry.faction);
  });

  it("says so when nothing matches", async () => {
    expect(await ask("lascannon points cost")).toContain("No official update or FAQ ruling");
  });
});
