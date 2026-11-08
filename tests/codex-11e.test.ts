import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import {
  applyDetachmentOverrides,
  applyEnhancementOverrides,
  applyUnitAbilityOverrides,
} from "../src/data/current-11e.js";
import type { Detachment, Enhancement, Unit } from "../src/types.js";

const det: Detachment = {
  id: "bs-1",
  name: "Shadow Keepers",
  faction: "F",
  ability: { name: "Old", description: "old" },
  detachmentPoints: 1,
  dispositions: ["Disruption"],
  restrictionTags: [],
  gameSystem: "wh40k-11e",
};

describe("codex overrides layered over generated BSData", () => {
  it("replaces a matching detachment's rule but keeps its id and other fields", () => {
    const [d] = applyDetachmentOverrides([det], [{ faction: "F", name: "Shadowkeepers", ability: { name: "New", description: "new" } }]);
    expect(d.id).toBe("bs-1");
    expect(d.ability.name).toBe("New");
    expect(d.dispositions).toEqual(["Disruption"]);
  });

  it("adds a detachment BSData lacks", () => {
    const out = applyDetachmentOverrides([det], [{ faction: "F", name: "Other", ability: { name: "R", description: "r" }, detachmentPoints: 1 }]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ name: "Other", detachmentPoints: 1, dispositions: [], gameSystem: "wh40k-11e" });
  });

  it("matches enhancements by faction, detachment and name", () => {
    const base: Enhancement[] = [
      { id: "e1", name: "Thing", faction: "F", detachment: "A", description: "x", points: 10, gameSystem: "wh40k-11e" },
    ];
    const out = applyEnhancementOverrides(base, [
      { faction: "F", detachment: "A", name: "Thing", points: 15, description: "y" },
      { faction: "F", detachment: "B", name: "Thing", points: 20, description: "z" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "e1", points: 15, description: "y" });
    expect(out[1]).toMatchObject({ detachment: "B", points: 20 });
  });

  it("rewrites an army-rule ability only on that faction's units", () => {
    const unit = (faction: string): Unit =>
      ({ faction, abilities: [{ name: "Rule", description: "old" }] }) as unknown as Unit;
    const [mine, theirs] = applyUnitAbilityOverrides([unit("F"), unit("G")], [{ faction: "F", name: "Rule", description: "new" }]);
    expect(mine.abilities[0].description).toBe("new");
    expect(theirs.abilities[0].description).toBe("old");
  });
});

let client: Client;

beforeAll(async () => {
  const server = createServer();
  client = new Client({ name: "test-client", version: "1.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(ct), server.connect(st)]);
});

async function call(name: string, args: Record<string, string>): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  return (result.content as Array<{ type: string; text: string }>)[0].text;
}

describe("Orks 11e codex", () => {
  it("labels a codex stratagem as current to the codex", async () => {
    const text = await call("lookup_stratagem", { name: "Hit 'Em Harder", faction: "Orks" });
    expect(text).toContain("Current to the 11th edition Orks codex, via Mark's saved pages (8 Nov 2026)");
    expect(text).toContain("[LETHAL HITS]");
  });

  it("shows stratagems for a detachment that had none before, with its 2CP stratagem", async () => {
    const text = await call("lookup_detachment", { name: "Runt Swarm", faction: "Orks" });
    expect(text).toContain("**Infested War Zone** (2 CP");
    expect(text).toContain("Grot Shields");
  });

  it("says a codex detachment without stratagems has none, rather than 'not covered'", async () => {
    const text = await call("lookup_detachment", { name: "Brute Bosses", faction: "Orks" });
    expect(text).toContain("gives this detachment no stratagems");
    expect(text).toContain("Da Gobshot Thunderbuss");
  });

  it("replaces the older War Horde text with the codex's", async () => {
    const text = await call("search_stratagems", { detachment: "War Horde" });
    expect(text).toContain("Breakin' Heads");
    expect(text).toContain("11e codex, 8 Nov 2026");
    expect(text).not.toContain("older:");
  });

  it("warns that a pack detachment missing from the codex may no longer be legal", async () => {
    const text = await call("lookup_stratagem", { name: "Brutal Broadside" });
    expect(text).toContain("Rollin' Deff isn't in the 11th edition Orks codex");
  });

  it("fills in the Dread Mob roll table", async () => {
    const text = await call("lookup_detachment", { name: "Dread Mob", faction: "Orks" });
    expect(text).toContain("3-4, +2 S");
  });

  it("gives Ork units the full Waaagh! army rule, including War Cry", async () => {
    const text = await call("lookup_unit", { unit_name: "Boyz", faction: "Orks" });
    expect(text).toContain("War Cry (once per battle, per army)");
  });
});

describe("Space Marines 11e codex", () => {
  it("shows Gladius Task Force's codex stratagems, labelled current", async () => {
    const text = await call("lookup_detachment", { name: "Gladius Task Force", faction: "Space Marines" });
    expect(text).toContain("**Adaptive Strategy** (1 CP");
    expect(text).toContain("Current to the 11th edition Space Marines codex");
  });

  it("records a 2CP codex stratagem", async () => {
    const text = await call("lookup_stratagem", { name: "Hail of Vengeance" });
    expect(text).toContain("**CP:** 2");
    expect(text).toContain("Devastator Brethren");
  });

  it("warns that a June pack detachment isn't in the codex pages", async () => {
    const text = await call("lookup_stratagem", { name: "Codex Discipline" });
    expect(text).toContain("Bastion Task Force isn't in the 11th edition Space Marines codex");
    expect(text).toContain("leave out the Chapter supplements");
  });

  it("adds the Venator Omni-Auspex BSData lacks", async () => {
    const text = await call("lookup_enhancement", { name: "Venator Omni-Auspex", detachment: "Phobos Shock Force" });
    expect(text).toContain("15 pts");
    expect(text).toContain("1-2");
  });
});

describe("Adeptus Custodes 11e codex", () => {
  it("adds the Shield Host detachments BSData lacks, with their stratagems and enhancements", async () => {
    const text = await call("lookup_detachment", { name: "Shadowkeepers", faction: "Adeptus Custodes" });
    expect(text).toContain("Wardens of the Dark Cells");
    expect(text).toContain("**No Escape** (2 CP");
    expect(text).toContain("Genalchemic Warding");
    expect(text).toContain("Mutually exclusive");
    expect(text).toContain("Current to the 11th edition Adeptus Custodes codex");
  });

  it("uses the codex's per-army limit for Leonine Ferocity", async () => {
    const text = await call("lookup_enhancement", { name: "Leonine Ferocity" });
    expect(text).toContain("Once per phase, per army");
    expect(text).toContain("SHIELD-CAPTAIN IN ALLARUS TERMINATOR ARMOUR model only");
  });

  it("no longer calls Custodes pack text possibly stale; flags detachments the codex dropped", async () => {
    expect(await call("lookup_stratagem", { name: "Vigil Unending" })).toContain("Current to the 11th edition Adeptus Custodes codex");
    expect(await call("search_stratagems", { detachment: "Talons of the Emperor" })).toContain("older: not in the 11e codex");
  });

  it("lists the ka'tah abilities in the Martial Ka'tah army rule", async () => {
    const text = await call("lookup_unit", { unit_name: "Custodian Guard", faction: "Adeptus Custodes" });
    expect(text).toContain("Rendax");
  });
});

describe("spot-check fixes from the other factions' saved pages", () => {
  it.each([
    ["Sustained by Agony", "D3+3"],
    ["Beautiful Death", "4+"],
    ["Glut of Souls", "5+"],
    ["A Dark Network", "within 12\""],
    ["Blitzing Firepower", "within 12\""],
  ])("%s has the number from the saved pages", async (name, expected) => {
    expect(await call("lookup_stratagem", { name })).toContain(expected);
  });
});
