import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { HERESY_UNITS } from "../src/data/heresy-units.js";
import { HERESY_WEAPONS } from "../src/data/heresy-weapons.js";
import { UNITS_11E } from "../src/data/units-11e.js";
import { normalizeName } from "../src/lib/search.js";
import { findHeresyWeapons, formatHeresyWeapon } from "../src/lib/heresy-format.js";

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

/** The table row whose first cell is `name`. */
function row(text: string, name: string): string[] {
  const line = text.split("\n").find((l) => l.startsWith(`| ${name} |`));
  expect(line, `row for ${name}`).toBeDefined();
  return line!.split("|").slice(1, -1).map((c) => c.trim());
}

describe("lookup_unit with game_mode heresy", () => {
  it("returns the Legion Tactical Squad (named 'Tactical Squad' in the data) with HH stats", async () => {
    const text = await call("lookup_unit", { unit_name: "Tactical Squad", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("# Tactical Squad");
    expect(text).toContain("Legiones Astartes");
    expect(text).toContain("| Model | Type | M | WS | BS | S | T | W | I | A | LD | CL | WP | IN | SAV | INV |");
    expect(row(text, "Legionary")).toEqual([
      "Legionary", "Infantry", "7", "4", "4", "4", "4", "1", "4", "1", "7", "7", "7", "7", "3+", "-",
    ]);
    expect(row(text, "Sergeant")[1]).toBe("Infantry (Sergeant)");
    // Composition and size: 9-19 Legionaries + 1 Sergeant.
    expect(text).toContain("- 9-19 Legionary");
    expect(text).toContain("- 1 Sergeant");
    expect(text).toContain("10-20 models");
    expect(text).toContain("Line (2)");
    expect(text).toContain("100 pts (+10 per extra Legionary)");
    // Context-only rules are separated, not presented as always-on.
    expect(text).toMatch(/Only with certain army options[^\n]*Loot the Dead \(2\)/);
    expect(text).not.toContain("| OC |");
  });

  it("returns the Contemptor Dreadnought with its stat line, Bulky (6) and a 5+ invulnerable save", async () => {
    const text = await call("lookup_unit", { unit_name: "Contemptor Dreadnought", game_mode: "heresy" });
    expect(text).toContain("# Contemptor Dreadnought");
    expect(row(text, "Contemptor Dreadnought")).toEqual([
      "Contemptor Dreadnought", "Walker", "8", "4", "4", "7", "7", "6", "4", "4", "12", "10", "7", "5", "2+", "5+",
    ]);
    expect(text).toContain("Bulky (6)");
    expect(text).toContain("Explodes (5+)");
    expect(text).not.toContain("Bulky (X)");
    // One model, not the 40K parser's weapon-children-as-models miscount.
    expect(text).toContain("**Unit Size:** 1 model");
    expect(row(text, "Twin volkite culverin")).toEqual([
      "Twin volkite culverin", "45", "6", "6", "5", "1", "Heavy (FP), Deflagrate (6)", "Volkite",
    ]);
  });

  it("'Contemptor' resolves to the generic Contemptor Dreadnought, not a Legion variant", async () => {
    const text = await call("lookup_unit", { unit_name: "Contemptor", game_mode: "heresy" });
    expect(text).toContain("# Contemptor Dreadnought");
  });

  it("shows vehicle armour profiles for a Rhino", async () => {
    const text = await call("lookup_unit", { unit_name: "Rhino", game_mode: "heresy" });
    expect(text).toContain("| Vehicle | Type | M | BS | Front Armour | Side Armour | Rear Armour | HP | Transport Capacity |");
    expect(row(text, "Rhino").slice(0, 8)).toEqual(["Rhino", "Vehicle (Transport)", "12", "4", "12", "11", "10", "5"]);
  });

  it("explains melee weapons as modifiers to the bearer (power fist: Strength user +4)", async () => {
    const text = await call("lookup_unit", { unit_name: "Tactical Squad", game_mode: "heresy" });
    expect(text).toContain("| Weapon | Initiative (IM) | Attacks (AM) | Strength (SM) | AP | Damage (D) | Special Rules | Traits |");
    expect(row(text, "Power fist")).toEqual(["Power fist", "user -3", "as user", "user +4", "2", "2", "-", "Power"]);
    expect(text).toContain("modify the bearer's own characteristics");
  });

  it("a Legion faction filter finds generic Legiones Astartes units", async () => {
    const text = await call("lookup_unit", { unit_name: "Tactical Squad", faction: "Ultramarines", game_mode: "heresy" });
    expect(text).toContain("# Tactical Squad");
  });

  it("labels a not-found response with the edition", async () => {
    const text = await call("lookup_unit", { unit_name: "Totally Fake Unit XYZZY", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("No Horus Heresy (3rd edition) unit found");
  });
});

describe("Horus Heresy weapons", () => {
  it("volkite culverin has its full ranged profile", () => {
    const [culverin] = findHeresyWeapons(HERESY_WEAPONS, "Volkite culverin");
    expect(culverin.name).toBe("Volkite culverin");
    expect(culverin.ranged).toEqual([
      {
        name: "Volkite culverin",
        range: "45",
        firepower: "3",
        rangedStrength: "6",
        ap: "5",
        damage: "1",
        specialRules: ["Heavy (FP)", "Deflagrate (6)"],
        traits: ["Volkite"],
      },
    ]);
    const text = formatHeresyWeapon([culverin]);
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("Volkite culverin: Range 45, Firepower 3, Ranged Strength 6, AP 5, Damage 1");
  });

  it("plasma gun keeps both of its profiles (Maximal and Sustained)", () => {
    const [plasma] = findHeresyWeapons(HERESY_WEAPONS, "Plasma gun");
    expect(plasma.name).toBe("Plasma gun");
    const byName = Object.fromEntries(plasma.ranged.map((p) => [p.name, p]));
    expect(Object.keys(byName).sort()).toEqual(["Plasma gun (Maximal)", "Plasma gun (Sustained)"]);
    expect(byName["Plasma gun (Maximal)"]).toMatchObject({ range: "24", firepower: "2", rangedStrength: "7", ap: "4", damage: "1" });
    expect(byName["Plasma gun (Maximal)"].specialRules).toEqual(["Breaching (5+)", "Overload (1)"]);
    expect(byName["Plasma gun (Sustained)"]).toMatchObject({ rangedStrength: "6" });
    expect(byName["Plasma gun (Sustained)"].specialRules).toEqual(["Breaching (6+)"]);
    expect(formatHeresyWeapon([plasma])).toContain("2 ranged profiles");
  });

  it("power fist reads as modifiers, never as a fixed strength", () => {
    const [fist] = findHeresyWeapons(HERESY_WEAPONS, "Power fist");
    expect(fist.melee[0]).toMatchObject({ initiativeModifier: "-3", attacksModifier: "A", strengthModifier: "+4", ap: "2", damage: "2" });
    const text = formatHeresyWeapon([fist]);
    expect(text).toContain("Power fist: Initiative user -3, Attacks as user, Strength user +4, AP 2, Damage 2");
    expect(text).not.toMatch(/Strength 4\b/);
  });

  it("weapon rules containing commas inside brackets stay whole", () => {
    const shock = HERESY_WEAPONS.flatMap((w) => [...w.ranged, ...w.melee]).flatMap((p) => p.specialRules);
    expect(shock.some((r) => r === "Shock (Pinning, Stunned, Suppressed)")).toBe(true);
    expect(shock).not.toContain("Stunned");
  });
});

describe("lookup_keyword with game_mode heresy (special rules)", () => {
  it("finds a variable rule from a query with a value and echoes X", async () => {
    const text = await call("lookup_keyword", { keyword: "Bulky (6)", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("# Bulky (X)");
    expect(text).toContain("As asked: Bulky (6)");
    expect(text).toContain("X = 6");
    expect(text).toContain("Transport Capacity");
  });

  it("finds a rule by its base name", async () => {
    const text = await call("lookup_keyword", { keyword: "rending", game_mode: "heresy" });
    expect(text).toContain("# Rending (X)");
    expect(text).toContain("## Rule Text");
  });

  it("flags a name shared with a 40K keyword without mixing in 40K text", async () => {
    const text = await call("lookup_keyword", { keyword: "Deep Strike", game_mode: "heresy" });
    expect(text).toContain("# Deep Strike");
    expect(text).toContain('also a 40K keyword; ask with game_mode "40k"');
    expect(text).not.toContain("Official Definition");
    expect(text).not.toContain("Plain English");
  });
});

describe("Heresy rules written on entries (not linked from sharedRules)", () => {
  const unit = (name: string) => {
    const u = HERESY_UNITS.find((x) => x.name === name);
    expect(u, name).toBeDefined();
    return u!;
  };

  it("gives Primarchs their own rules", () => {
    expect(unit("Fulgrim").specialRules).toEqual(
      expect.arrayContaining(["Sublime Swordsman", "Sire of the Emperor's Children"]),
    );
    // Horus's rules sit on mandatory upgrades, alongside his weapons.
    const horus = unit("Horus Lupercal").specialRules;
    expect(horus).toEqual(expect.arrayContaining(["Sire of the Sons of Horus", "Master of War"]));
    // Weapon rules stay on the weapons.
    for (const r of horus) expect(r).not.toMatch(/^(Breaching|Shred|Critical Hit)/);
  });

  it("keeps weapon rules off the Tactical Squad", () => {
    expect(unit("Tactical Squad").specialRules).toEqual(["Line (2)", "Fury of the Legion"]);
  });

  it("finds Prime Advantages and Cybertheurgic Rites with lookup_keyword", async () => {
    const prime = await call("lookup_keyword", { keyword: "Logistical Benefit", game_mode: "heresy" });
    expect(prime).toContain("# Logistical Benefit");
    const rite = await call("lookup_keyword", { keyword: "Overcharge Reactors", game_mode: "heresy" });
    expect(rite).toContain("# Overcharge Reactors");
    expect(rite).toContain("Cybertheurgic Rite");
  });
});

describe("search_units with game_mode heresy", () => {
  it("returns edition-labelled compact results", async () => {
    const text = await call("search_units", { query: "Tactical", game_mode: "heresy" });
    expect(text.startsWith(HERESY_STAMP)).toBe(true);
    expect(text).toContain("**Tactical Squad** (Legiones Astartes)");
  });

  it("filters by special rule", async () => {
    const text = await call("search_units", { query: "Dreadnought", ability: "Bulky", game_mode: "heresy" });
    expect(text).toContain("Contemptor Dreadnought");
  });
});

describe("40K / Horus Heresy separation", () => {
  it("every heresy response is labelled and never uses 40K stat headers", async () => {
    const responses = await Promise.all([
      call("lookup_unit", { unit_name: "Contemptor Dreadnought", game_mode: "heresy" }),
      call("lookup_unit", { unit_name: "Warlord Titan", game_mode: "heresy" }),
      call("search_units", { query: "Rhino", game_mode: "heresy" }),
      call("lookup_keyword", { keyword: "Heavy", game_mode: "heresy" }),
      call("lookup_keyword", { keyword: "Not A Real Rule Qqq", game_mode: "heresy" }),
    ]);
    for (const text of responses) {
      expect(text.startsWith(HERESY_STAMP)).toBe(true);
      expect(text).not.toContain("[Mode: 40k");
      expect(text).not.toContain("Not Warhammer 40,000");
      expect(text).not.toContain("| OC |");
      expect(text).not.toContain("| BS | S | AP | D | Keywords |");
    }
  });

  it("default 40K lookups never return Heresy datasheets", async () => {
    const text = await call("lookup_unit", { unit_name: "Intercessor Squad" });
    expect(text.startsWith("[Mode: 40k 11e]")).toBe(true);
    expect(text).toContain("| Name | M | T | SV | W | LD | OC |");
    expect(text).not.toContain("Horus Heresy");
  });

  it("a 40K name that is also an HH unit gets a one-line hint, not HH content", async () => {
    expect(UNITS_11E.filter((u) => u.name === "Mortarion")).toHaveLength(1);
    expect(HERESY_UNITS.some((u) => u.name === "Mortarion")).toBe(true);
    const text = await call("lookup_unit", { unit_name: "Mortarion" });
    expect(text.startsWith("[Mode: 40k 11e]")).toBe(true);
    expect(text).toContain("| Name | M | T | SV | W | LD | OC |");
    expect(text).toContain('also a Horus Heresy (3rd edition) unit; ask with game_mode "heresy"');
    expect(text).not.toContain("| WS | BS | S | T | W | I | A |");
  });

  it("40K output for a name with no Heresy counterpart carries no hint", async () => {
    expect(HERESY_UNITS.some((u) => normalizeName(u.name) === normalizeName("Intercessor Squad"))).toBe(false);
    const text = await call("lookup_unit", { unit_name: "Intercessor Squad" });
    expect(text).not.toContain("game_mode \"heresy\"");
  });

  it("search_units default mode never lists Heresy-only units", async () => {
    const text = await call("search_units", { query: "Contemptor-Incaendius" });
    expect(text).not.toContain("Horus Heresy");
    expect(text).not.toContain("Contemptor-Incaendius Dreadnought");
  });

  it("lookup_keyword default mode answers a curated 40K keyword, with a one-line Heresy hint", async () => {
    const text = await call("lookup_keyword", { keyword: "Deep Strike" });
    expect(text).toContain("Official Definition");
    expect(text).not.toContain("[Mode: Horus Heresy");
    expect(text).toContain('is also a Horus Heresy (3rd edition) special rule; ask with game_mode "heresy"');
  });

  it("Kill Team lookups are unaffected", async () => {
    const text = await call("lookup_unit", { unit_name: "Space Marine Captain", game_mode: "kill_team" });
    expect(text.startsWith("[Mode: Kill Team]")).toBe(true);
    expect(text).not.toContain("Horus Heresy");
  });
});
