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

describe("search_stratagems", () => {
  it("is registered", async () => {
    const { tools } = await client.listTools();
    expect(tools.find((t) => t.name === "search_stratagems")).toBeDefined();
  });

  it("returns results for broad query", async () => {
    const result = await client.callTool({
      name: "search_stratagems",
      arguments: { query: "re-roll" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Command Re-Roll");
    expect(text).toContain("Warhammer 40,000");
  });

  it("filters by phase", async () => {
    const result = await client.callTool({
      name: "search_stratagems",
      arguments: { query: "fight", phase: "Fight" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Fight phase");
  });

  it("lists by filters alone, with any-phase stratagems included", async () => {
    const result = await client.callTool({
      name: "search_stratagems",
      arguments: { faction: "Core", phase: "Shooting phase" },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Command Re-Roll");
    expect(text).toContain("Shooting phase");
  });

  it("one call returns a detachment's stratagems plus Core for a phase", async () => {
    const result = await client.callTool({
      name: "search_stratagems",
      arguments: { detachment: "Kult of Speed", phase: "Shooting phase", include_core: true },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Dakkastorm");
    expect(text).toContain("Command Re-Roll");
  });

  it("asks for something when given nothing at all", async () => {
    const result = await client.callTool({ name: "search_stratagems", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("at least one of");
  });

  it("suggests lookup_ploy when no results", async () => {
    const result = await client.callTool({
      name: "search_stratagems",
      arguments: { query: "xyznonexistent" },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("lookup_ploy");
  });
});
