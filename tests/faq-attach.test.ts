import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { attachRulings, HEADING } from "../src/lib/faq-attach.js";
import "../src/lib/faq-11e.js";
import "../src/lib/heresy-faq.js";

let client: Client;
const text = async (name: string, args: Record<string, unknown>) =>
  ((await client.callTool({ name, arguments: args })).content as Array<{ text: string }>)[0].text;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "t", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

describe("official rulings attached to answers", () => {
  it("a unit's answer carries a ruling that names it", async () => {
    const t = await text("lookup_unit", { unit_name: "Hive Tyrant", faction: "Tyranids" });
    expect(t).toContain(HEADING);
    expect(t).toContain("Tyrant Guard");
  });

  it("a generic rule doesn't pull in one army's ruling", async () => {
    expect(await text("lookup_keyword", { keyword: "Stealth" })).not.toContain(HEADING);
  });

  it("core rulings still attach to core rules", async () => {
    expect(await text("lookup_keyword", { keyword: "Disembark" })).toContain(HEADING);
  });

  it("never more than the limit, never the same ruling twice", () => {
    const t = attachRulings({ system: "40k", names: ["Disembark", "disembarking", "Disembark"], limit: 2 });
    expect((t.match(/\*\*Q:\*\*/g) || []).length).toBeLessThanOrEqual(2);
    const qs = t.split("**Q:**").slice(1);
    expect(new Set(qs).size).toBe(qs.length);
  });

});

describe("Horus Heresy rulings attached to answers", () => {
  it("a variable rule matches its own name, not a longer term sharing a word", async () => {
    const force = await text("lookup_keyword", { keyword: "Force", game_mode: "heresy" });
    const rulings = force.split(HEADING)[1] ?? "";
    expect(rulings).toContain("Force (X) Special Rule");
    expect(rulings).not.toContain("Force Organisation");
    // "Line (X)" vs "Line of Sight"
    expect(attachRulings({ system: "heresy", names: ["Line (X)"] })).toBe("");
  });

  it("needs the name in the ruling's question, not a passing mention in the answer", () => {
    // A Line of Sight ruling's answer mentions bayonets and vexilla
    expect(attachRulings({ system: "heresy", names: ["Bayonet"], specific: true })).toBe("");
  });

  it("a weapon's answer carries a ruling that names it", async () => {
    const t = await text("lookup_weapon", { weapon_name: "Lightning claw", game_mode: "heresy" });
    expect(t).toContain(HEADING);
    expect(t).toContain("paired");
  });

  it("a unit with no ruling gets none", async () => {
    expect(await text("lookup_unit", { unit_name: "Tactical Squad", game_mode: "heresy" })).not.toContain(HEADING);
  });
});
