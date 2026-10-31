import { describe, it, expect } from "vitest";
import {
  cleanCatalogueName,
  parseHeresyData,
  splitList,
  type HeresySourceFile,
} from "../src/lib/heresy-parser.js";
import { formatMeleeModifier, findHeresyRules, splitRuleQuery } from "../src/lib/heresy-format.js";

// Minimal BSData-shaped HH3 JSON fixtures (the real files ship as JSON with
// flat arrays and "$text" values, exactly like this).

const PROFILE = "a76f-8e23-8c3e-166d";
const RANGED = "c591-09ed-3e6f-eb2b";
const MELEE = "3587-6dcd-005c-c263";
const POINTS = "9893-c379-920b-8982";

function statLine(name: string, type: string, extra: Record<string, string> = {}) {
  const stats: Record<string, string> = {
    Type: type, M: "7", WS: "4", BS: "4", S: "4", T: "4", W: "1", I: "4", A: "1",
    LD: "7", CL: "7", WP: "7", IN: "7", SAV: "3+", INV: "-", ...extra,
  };
  return {
    name,
    id: `p-${name}`,
    typeId: PROFILE,
    typeName: "Profile",
    characteristics: Object.entries(stats).map(([n, v]) => ({ name: n, $text: v })),
  };
}

function cost(value: number) {
  return [{ name: "Point(s)", typeId: POINTS, value }];
}

const gameSystem = {
  gameSystem: {
    id: "sys-1",
    name: "Horus Heresy 3rd Edition",
    sharedRules: [
      { id: "r-deep", name: "Deep Strike", description: '"The Deep Strike Special Rule allows a Unit to enter play anywhere."\nPlace it 1"" away.' },
    ],
  },
};

const specialRules = {
  catalogue: {
    id: "cat-rules",
    name: "Special Rules",
    library: true,
    sharedRules: [
      { id: "r-bulky", name: "Bulky (X)", alias: ["Bulky"], description: "**Models with Bulky (X) take more space.**\n\nThey use X points." },
      { id: "r-line", name: "Line (X)", description: "**Line units score.**\n\nBody." },
      { id: "r-loot", name: "Loot the Dead (X)", description: "**Loot.**\n\nBody." },
    ],
  },
};

const weapons = {
  catalogue: {
    id: "cat-weapons",
    name: "Weapons",
    library: true,
    sharedSelectionEntries: [
      {
        id: "w-bolter",
        name: "Bolter",
        type: "upgrade",
        profiles: [
          {
            id: "wp-bolter", name: "Bolter", typeId: RANGED, typeName: "Ranged Weapon",
            characteristics: [
              { name: "R", $text: "24" }, { name: "FP", $text: "2" }, { name: "RS", $text: "4" },
              { name: "AP", $text: "5" }, { name: "D", $text: "1" }, { name: "Special Rules", $text: "-" },
              { name: "Traits", $text: "Bolt" },
            ],
          },
        ],
      },
      {
        id: "w-fist",
        name: "Power fist",
        type: "upgrade",
        profiles: [
          {
            id: "wp-fist", name: "Power fist", typeId: MELEE, typeName: "Melee Weapon",
            characteristics: [
              { name: "IM", $text: "-3" }, { name: "AM", $text: "A" }, { name: "SM", $text: "+4" },
              { name: "AP", $text: "2" }, { name: "D", $text: "2" }, { name: "Special Rules", $text: "" },
              { name: "Traits", $text: "Power" },
            ],
          },
        ],
      },
    ],
  },
};

const astartes = {
  catalogue: {
    id: "cat-la",
    name: "Legiones Astartes",
    library: true,
    catalogueLinks: [{ targetId: "cat-weapons", importRootEntries: false }],
    entryLinks: [
      { id: "link-tac", name: "Tactical Squad", targetId: "u-tac", type: "selectionEntry" },
      { id: "link-dread", name: "Contemptor Dreadnought", targetId: "u-dread", type: "selectionEntry" },
      // An allied Mechanicum unit, root-linked from the library: belongs to Mechanicum.
      { id: "link-thallax", name: "Thallax Cohort", targetId: "u-thallax", type: "selectionEntry" },
    ],
    sharedSelectionEntries: [
      {
        id: "u-tac",
        name: "Tactical Squad",
        type: "unit",
        costs: cost(10),
        infoLinks: [
          { id: "il-line", name: "Line (X)", targetId: "r-line", type: "rule", modifiers: [{ field: "name", type: "set", value: "Line (2)" }] },
          {
            id: "il-loot", name: "Loot the Dead (X)", targetId: "r-loot", type: "rule", hidden: true,
            modifiers: [
              { arg: "X", field: "name", type: "replace", value: 2 },
              {
                field: "hidden", type: "set", value: false,
                conditions: [{ childId: "rite", field: "selections", scope: "roster", type: "atLeast", value: 1 }],
              },
            ],
          },
        ],
        selectionEntries: [
          {
            id: "m-leg",
            name: "Legionary",
            type: "model",
            costs: cost(10),
            constraints: [
              { field: "selections", scope: "parent", type: "min", value: 9 },
              { field: "selections", scope: "parent", type: "max", value: 19 },
            ],
            profiles: [statLine("Legionary", "Infantry")],
            entryLinks: [
              {
                id: "el-bolter", name: "Bolter", targetId: "w-bolter", type: "selectionEntry",
                constraints: [
                  { field: "selections", scope: "parent", type: "min", value: 1 },
                  { field: "selections", scope: "parent", type: "max", value: 1 },
                ],
              },
            ],
          },
          {
            id: "m-sgt",
            name: "Sergeant",
            type: "model",
            constraints: [
              { field: "selections", scope: "parent", type: "min", value: 1 },
              { field: "selections", scope: "parent", type: "max", value: 1 },
            ],
            profiles: [statLine("Sergeant", "Infantry (Sergeant)", { LD: "8" })],
            selectionEntryGroups: [
              {
                id: "g-sgt",
                name: "May exchange bolter for:",
                defaultSelectionEntryId: "el-sgt-bolter",
                constraints: [
                  { field: "selections", scope: "parent", type: "min", value: 1 },
                  { field: "selections", scope: "parent", type: "max", value: 1 },
                ],
                entryLinks: [
                  { id: "el-sgt-bolter", name: "Bolter", targetId: "w-bolter", type: "selectionEntry" },
                  { id: "el-sgt-fist", name: "Power fist", targetId: "w-fist", type: "selectionEntry", costs: cost(15) },
                ],
              },
            ],
          },
        ],
        entryLinks: [
          // A roster-level pool that must not leak into the unit.
          { id: "el-wod", name: "Weapons of Desperation", targetId: "g-wod", type: "selectionEntryGroup" },
        ],
      },
      {
        id: "u-dread",
        name: "Contemptor Dreadnought",
        type: "unit",
        costs: cost(150),
        infoLinks: [
          { id: "il-bulky", name: "Bulky (X)", targetId: "r-bulky", type: "rule", modifiers: [{ field: "name", type: "set", value: "Bulky (6)" }] },
        ],
        selectionEntries: [
          {
            id: "m-dread",
            name: "Contemptor Dreadnought",
            type: "model",
            constraints: [
              { field: "selections", scope: "parent", type: "min", value: 1 },
              { field: "selections", scope: "parent", type: "max", value: 1 },
            ],
            profiles: [statLine("Contemptor Dreadnought", "Walker", { S: "7", T: "7", W: "6", INV: "5+" })],
          },
        ],
        // Weapon options are plain upgrade entries: they must not be counted as models.
        selectionEntryGroups: [
          {
            id: "g-opt1",
            name: "1) Weapon Option 1",
            constraints: [
              { field: "selections", scope: "parent", type: "min", value: 1 },
              { field: "selections", scope: "parent", type: "max", value: 1 },
            ],
            entryLinks: [
              { id: "o1", name: "Bolter", targetId: "w-bolter", type: "selectionEntry" },
              { id: "o2", name: "Power fist", targetId: "w-fist", type: "selectionEntry" },
            ],
          },
        ],
      },
    ],
    sharedSelectionEntryGroups: [
      {
        id: "g-wod",
        name: "Weapons of Desperation",
        entryLinks: [{ id: "el-wod-fist", name: "Power fist", targetId: "w-fist", type: "selectionEntry" }],
      },
    ],
  },
};

const mechanicum = {
  catalogue: {
    id: "cat-mech",
    name: "Mechanicum",
    entryLinks: [{ id: "link-mech-thallax", name: "Thallax Cohort", targetId: "u-thallax", type: "selectionEntry" }],
    sharedSelectionEntries: [
      {
        id: "u-thallax",
        name: "Thallax Cohort",
        type: "unit",
        selectionEntries: [{ id: "m-thallax", name: "Thallax", type: "model", profiles: [statLine("Thallax", "Infantry")] }],
      },
    ],
  },
};

function legion(id: string, rawName: string) {
  return {
    catalogue: {
      id,
      name: rawName,
      catalogueLinks: [
        { targetId: "cat-la", importRootEntries: true },
        { targetId: "cat-mech", importRootEntries: false },
      ],
    },
  };
}

const FILES: HeresySourceFile[] = [
  { path: "Horus Heresy 3rd Edition.json", data: gameSystem },
  { path: "Special Rules.json", data: specialRules },
  { path: "Weapons.json", data: weapons },
  { path: "Legiones Astartes.json", data: astartes },
  { path: "Mechanicum.json", data: mechanicum },
  { path: "Ultramarines.json", data: legion("cat-um", "                        XIII - Ultramarines") },
  { path: "Dark Angels.json", data: legion("cat-da", "                         I - Dark Angels") },
];

const result = parseHeresyData(FILES);
const unit = (name: string) => result.units.filter((u) => u.name === name);

describe("cleanCatalogueName", () => {
  it("strips padding and splits off the Legion numeral", () => {
    expect(cleanCatalogueName("                        XIII - Ultramarines")).toEqual({ name: "Ultramarines", legion: "XIII" });
    expect(cleanCatalogueName("Solar Auxilia")).toEqual({ name: "Solar Auxilia", legion: null });
  });
});

describe("splitList", () => {
  it("splits at top-level commas only and drops '-'/'None'", () => {
    expect(splitList("Shock (Pinning, Stunned), Breaching (6+)")).toEqual(["Shock (Pinning, Stunned)", "Breaching (6+)"]);
    expect(splitList("-")).toEqual([]);
    expect(splitList("None")).toEqual([]);
    expect(splitList("Sword of\nthe Order")).toEqual(["Sword of the Order"]);
  });
});

describe("parseHeresyData — attribution and de-duplication", () => {
  it("emits each Legiones Astartes unit once, not once per importing Legion", () => {
    expect(unit("Tactical Squad")).toHaveLength(1);
    expect(unit("Tactical Squad")[0].faction).toBe("Legiones Astartes");
  });

  it("records the Legions that import the library in availableIn", () => {
    expect(unit("Tactical Squad")[0].availableIn).toEqual(["Dark Angels", "Ultramarines"]);
  });

  it("attributes an allied unit root-linked from another catalogue to its own catalogue", () => {
    const thallax = unit("Thallax Cohort");
    expect(thallax).toHaveLength(1);
    expect(thallax[0].faction).toBe("Mechanicum");
    // Linked from Legiones Astartes, so the Legions importing it can field it.
    expect(thallax[0].availableIn).toEqual(["Dark Angels", "Ultramarines"]);
  });

  it("lists cleaned faction names with Legion numerals", () => {
    expect(result.factions).toContainEqual({ name: "Ultramarines", legion: "XIII", library: false });
    expect(result.factions.every((f) => f.name === f.name.trim())).toBe(true);
  });
});

describe("parseHeresyData — units", () => {
  const tac = unit("Tactical Squad")[0];
  const dread = unit("Contemptor Dreadnought")[0];

  it("reads the HH stat line", () => {
    expect(tac.models.map((m) => [m.name, m.type, m.leadership])).toEqual([
      ["Legionary", "Infantry", "7"],
      ["Sergeant", "Infantry (Sergeant)", "8"],
    ]);
    expect(dread.models[0]).toMatchObject({ type: "Walker", strength: "7", toughness: "7", wounds: "6", invulnerableSave: "5+" });
  });

  it("counts models only (weapon options are not models)", () => {
    expect(tac.composition).toEqual([
      { model: "Legionary", min: 9, max: 19 },
      { model: "Sergeant", min: 1, max: 1 },
    ]);
    expect(tac.unitSize).toEqual({ min: 10, max: 20 });
    expect(dread.unitSize).toEqual({ min: 1, max: 1 });
  });

  it("applies rule-name modifiers for (X) values", () => {
    expect(dread.specialRules).toEqual(["Bulky (6)"]);
    expect(tac.specialRules).toEqual(["Line (2)"]);
  });

  it("keeps base-hidden, roster-conditional rules out of the always-on list", () => {
    expect(tac.specialRules).not.toContain("Loot the Dead (2)");
    expect(tac.conditionalRules).toEqual(["Loot the Dead (2)"]);
  });

  it("collects weapons from model loadouts and options, but not roster-level pools", () => {
    expect(tac.rangedWeapons.map((w) => w.name)).toEqual(["Bolter"]);
    expect(tac.meleeWeapons.map((w) => w.name)).toEqual(["Power fist"]);
    expect(tac.wargear.find((w) => w.model === "Sergeant")).toEqual({
      model: "Sergeant",
      default: ["Bolter"],
      options: ["Bolter can be replaced with Power fist (+15 pts)"],
    });
  });

  it("computes base points from the unit and per-model costs", () => {
    expect(tac.points).toEqual({ base: 100, perExtraModel: [{ model: "Legionary", points: 10 }] });
    expect(dread.points).toEqual({ base: 150, perExtraModel: [] });
  });

  it("stamps the game system", () => {
    expect(result.units.every((u) => u.gameSystem === "horus-heresy-3e")).toBe(true);
  });
});

describe("parseHeresyData — weapons and rules", () => {
  it("keeps melee modifiers as written", () => {
    const fist = result.weapons.find((w) => w.name === "Power fist")!;
    expect(fist.melee[0]).toMatchObject({ initiativeModifier: "-3", attacksModifier: "A", strengthModifier: "+4" });
    expect(fist.melee[0].specialRules).toEqual([]);
  });

  it("extracts rule summaries and aliases, and tidies doubled inch marks", () => {
    const bulky = result.rules.find((r) => r.name === "Bulky (X)")!;
    expect(bulky.summary).toBe("Models with Bulky (X) take more space.");
    expect(bulky.aliases).toEqual(["Bulky"]);
    const deep = result.rules.find((r) => r.name === "Deep Strike")!;
    expect(deep.summary).toBe("The Deep Strike Special Rule allows a Unit to enter play anywhere.");
    expect(deep.description).toContain('1" away');
    expect(deep.source).toBe("Horus Heresy 3rd Edition");
  });
});

describe("heresy-format helpers", () => {
  it("phrases melee modifiers relative to the bearer", () => {
    expect(formatMeleeModifier("+4", "S")).toBe("user +4");
    expect(formatMeleeModifier("-3", "I")).toBe("user -3");
    expect(formatMeleeModifier("S", "S")).toBe("as user");
    expect(formatMeleeModifier("x2", "S")).toBe("user x2");
    expect(formatMeleeModifier("9", "S")).toBe("9 (as listed)");
    expect(formatMeleeModifier("-", "I")).toBe("-");
  });

  it("parses a rule query with a value", () => {
    expect(splitRuleQuery("Bulky (6)")).toEqual({ base: "bulky", value: "6" });
    expect(splitRuleQuery("Bulky (X)")).toEqual({ base: "bulky", value: null });
    expect(splitRuleQuery("Rending")).toEqual({ base: "rending", value: null });
  });

  it("matches rules by base name, value or alias", () => {
    expect(findHeresyRules(result.rules, "bulky (3)")[0].name).toBe("Bulky (X)");
    expect(findHeresyRules(result.rules, "Deep Strike")[0].name).toBe("Deep Strike");
    expect(findHeresyRules(result.rules, "zzzz qqqq")).toEqual([]);
  });
});
