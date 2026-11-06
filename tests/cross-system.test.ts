import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { HERESY_UNITS } from "../src/data/heresy-units.js";
import { HERESY_SPECIAL_RULES } from "../src/data/heresy-rules.js";
import { UNITS_11E } from "../src/data/units-11e.js";
import { KEYWORDS } from "../src/data/keywords.js";
import { normalizeName } from "../src/lib/search.js";
import { shouldCrossOver, stripCatalogueTag, withCrossSystemNote } from "../src/lib/cross-system.js";
import { splitWeaponName } from "../src/lib/weapon-match.js";

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
const STAMP_40K = "[Mode: 40k 11e]";
const in40k = (name: string) => UNITS_11E.some((u) => normalizeName(stripCatalogueTag(u.name)) === normalizeName(name));
const WEAPONS_40K = new Set(
  UNITS_11E.flatMap((u) => [...u.rangedWeapons, ...u.meleeWeapons].map((w) => normalizeName(splitWeaponName(w.name).base))),
);
const inHeresy = (name: string) => HERESY_UNITS.some((u) => normalizeName(u.name) === normalizeName(name));

describe("cross-system thresholds", () => {
  it("crosses over only from a weak home match to a strong other match", () => {
    expect(shouldCrossOver(0, 1)).toBe(true);
    expect(shouldCrossOver(0.82, 1)).toBe(true); // whole-word run in 40K vs exact Heresy name
    expect(shouldCrossOver(0.88, 1)).toBe(false); // a name-prefix match at home is good enough
    expect(shouldCrossOver(1, 1)).toBe(false); // shared name stays home
    expect(shouldCrossOver(0, 0.82)).toBe(false); // the other system's match must be strong
    expect(shouldCrossOver(0, 0.4)).toBe(false); // never a misspelling-grade match
  });

  it("puts the note right after the mode stamp", () => {
    expect(withCrossSystemNote("[S]\n\n# X", "[S]", "Found elsewhere.")).toBe("[S]\n\n_Found elsewhere._\n\n# X");
    expect(withCrossSystemNote("# X", "", "Found elsewhere.")).toBe("_Found elsewhere._\n\n# X");
  });
});

describe("lookup_unit cross-system fallback", () => {
  it("a Heresy-only unit with no game_mode returns the Heresy datasheet", async () => {
    expect(in40k("Contemptor Dreadnought")).toBe(false);
    expect(inHeresy("Contemptor Dreadnought")).toBe(true);
    const text = await call("lookup_unit", { unit_name: "Contemptor Dreadnought" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("_Found in Horus Heresy, not 40K.");
    expect(text).toContain("# Contemptor Dreadnought");
    expect(text).toContain("| Model | Type | M | WS | BS | S | T | W | I | A | LD | CL | WP | IN | SAV | INV |");
  });

  it("another Heresy-only unit (Legion Tactical Squad) also falls back", async () => {
    expect(in40k("Tactical Squad")).toBe(false);
    const text = await call("lookup_unit", { unit_name: "Tactical Squad" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("Legiones Astartes");
  });

  it("a 40K-only unit is unaffected", async () => {
    expect(inHeresy("Intercessor Squad")).toBe(false);
    const text = await call("lookup_unit", { unit_name: "Intercessor Squad" });
    expect(text.startsWith(STAMP_40K)).toBe(true);
    expect(text).not.toContain("Horus Heresy");
  });

  it("a name in both systems answers from 40K with the one-line Heresy hint", async () => {
    for (const name of ["Mortarion", "Rhino"]) {
      expect(in40k(name) && inHeresy(name)).toBe(true);
      const text = await call("lookup_unit", { unit_name: name });
      expect(text.startsWith(STAMP_40K)).toBe(true);
      expect(text).toContain("| Name | M | T | SV | W | LD | OC |");
      expect(text).toContain(`_"${name}" is also a Horus Heresy (3rd edition) unit; ask with game_mode "heresy"`);
      expect(text).not.toContain("Found in Horus Heresy");
    }
  });

  it("a 40K [Legends] datasheet counts as the same name (40K wins, with the hint)", async () => {
    const text = await call("lookup_unit", { unit_name: "Leviathan Dreadnought" });
    expect(text.startsWith(STAMP_40K)).toBe(true);
    expect(text).toContain('_"Leviathan Dreadnought" is also a Horus Heresy (3rd edition) unit');
  });

  it("a weak 40K fuzzy match does not beat nothing, and a weak Heresy match never wins", async () => {
    // A misspelling with no strong match anywhere stays a 40K answer.
    const text = await call("lookup_unit", { unit_name: "Intercesor Squad" });
    expect(text.startsWith(STAMP_40K)).toBe(true);
    expect(text).toContain("# Intercessor Squad");
  });

  it("explicit game_mode 40k: no substitution, the 40K answer plus a one-line Heresy pointer", async () => {
    const text = await call("lookup_unit", { unit_name: "Tactical Squad", game_mode: "40k" });
    expect(text).toContain('Not in Warhammer 40,000; Horus Heresy has "Tactical Squad" (game_mode "heresy").');
    expect(text).toContain("No unit found");
    expect(text).not.toContain(HERESY_STAMP);
    expect(text).not.toContain("| WS | BS |");
  });

  it("explicit game_mode heresy: no substitution, the Heresy not-found plus a one-line 40K pointer", async () => {
    expect(inHeresy("Bloodletters")).toBe(false);
    const text = await call("lookup_unit", { unit_name: "Bloodletters", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("No Horus Heresy (3rd edition) unit found");
    expect(text).toContain('Not in Horus Heresy; Warhammer 40,000 has "Bloodletters" (game_mode "40k").');
    expect(text).not.toContain(STAMP_40K);
    expect(text).not.toContain("| OC |");
  });

  it("an explicit heresy query for a shared name stays in Heresy", async () => {
    const text = await call("lookup_unit", { unit_name: "Rhino", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).not.toContain("Found in 40K");
  });
});

describe("lookup_keyword cross-system fallback", () => {
  it("a Heresy-only rule with no game_mode returns the Heresy rule", async () => {
    expect(KEYWORDS.some((k) => normalizeName(k.name).includes("bulky"))).toBe(false);
    expect(HERESY_SPECIAL_RULES.some((r) => r.name === "Bulky (X)")).toBe(true);
    const text = await call("lookup_keyword", { keyword: "Bulky" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("_Found in Horus Heresy, not 40K.");
    expect(text).toContain("# Bulky (X)");
  });

  it("a 40K-only keyword is unaffected", async () => {
    const text = await call("lookup_keyword", { keyword: "Devastating Wounds" });
    expect(text).toContain("# Devastating Wounds");
    expect(text).toContain("Official Definition");
    expect(text).not.toContain("Horus Heresy");
  });

  it("a keyword in both systems answers from 40K with the one-line Heresy hint", async () => {
    const text = await call("lookup_keyword", { keyword: "Feel No Pain" });
    expect(text).toContain("Official Definition");
    expect(text).not.toContain(HERESY_STAMP);
    expect(text).toContain('is also a Horus Heresy (3rd edition) special rule; ask with game_mode "heresy"');
  });

  it("a value in the query does not push a 40K keyword over to Heresy", async () => {
    const text = await call("lookup_keyword", { keyword: "Feel No Pain (5+)" });
    expect(text).toContain("# Feel No Pain");
    expect(text).not.toContain(HERESY_STAMP);
  });

  // Both answer with the rule, labelled: a voice model reads a bare pointer aloud instead of following it.
  it("explicit game_mode heresy for a 40K-only keyword: the 40K rule, labelled", async () => {
    const text = await call("lookup_keyword", { keyword: "Devastating Wounds", game_mode: "heresy" });
    expect(text).toContain("Not in Horus Heresy. This is the Warhammer 40,000 rule.");
    expect(text).toContain("Official Definition");
    expect(text).not.toContain(HERESY_STAMP);
  });

  it("explicit game_mode 40k for a Heresy-only rule: the Heresy rule, labelled", async () => {
    const text = await call("lookup_keyword", { keyword: "Bulky", game_mode: "40k" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("_Found in Horus Heresy, not 40K.");
    expect(text).toContain("# Bulky (X)");
  });
});

describe("lookup_weapon cross-system fallback and Heresy weapons", () => {
  it("game_mode heresy returns the Heresy profile with Heresy stat names", async () => {
    const text = await call("lookup_weapon", { weapon_name: "Volkite culverin", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("Volkite culverin: Range 45, Firepower 3, Ranged Strength 6, AP 5, Damage 1");
    expect(text).toContain('is also a 40K weapon; ask with game_mode "40k"');
    expect(text).not.toContain("Not Warhammer 40,000");
  });

  it("a Heresy-only weapon with no game_mode returns the Heresy profile", async () => {
    expect(WEAPONS_40K.has("graviton gun")).toBe(false);
    const text = await call("lookup_weapon", { weapon_name: "Graviton gun" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("_Found in Horus Heresy, not 40K.");
    expect(text).toContain("Graviton gun: Range 18");
  });

  it("a 40K-only weapon is unaffected", async () => {
    const text = await call("lookup_weapon", { weapon_name: "Boltgun" });
    expect(text.startsWith(STAMP_40K)).toBe(true);
    expect(text).not.toContain("Horus Heresy");
  });

  it("a weapon in both systems answers from 40K with the one-line Heresy hint", async () => {
    expect(WEAPONS_40K.has("volkite culverin")).toBe(true);
    const text = await call("lookup_weapon", { weapon_name: "Volkite culverin" });
    expect(text.startsWith(STAMP_40K)).toBe(true);
    expect(text).toContain('_"Volkite culverin" is also a Horus Heresy (3rd edition) weapon; ask with game_mode "heresy"');
  });

  it("explicit game_mode 40k for a Heresy-only weapon: 40K answer plus a Heresy pointer, no substitution", async () => {
    const text = await call("lookup_weapon", { weapon_name: "Graviton gun", game_mode: "40k" });
    expect(text).toContain('No weapon found named "Graviton gun"');
    expect(text).not.toContain(HERESY_STAMP);
    expect(text).toContain('Not in Warhammer 40,000; Horus Heresy has "Graviton gun" (game_mode "heresy").');
    expect(text).not.toContain("Firepower");
  });

  it("explicit game_mode heresy for a 40K-only weapon: Heresy not-found plus a 40K pointer", async () => {
    const text = await call("lookup_weapon", { weapon_name: "Boltgun", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain('Not in Horus Heresy; Warhammer 40,000 has "Boltgun" (game_mode "40k").');
    expect(text).not.toContain(STAMP_40K);
  });
});
