import { afterEach, describe, expect, it, vi } from "vitest";
import { fetch11e } from "../scripts/fetch-data.js";

afterEach(() => vi.unstubAllGlobals());

describe("11e catalogue unit selection", () => {
  it("omits an orphaned shared model while retaining the same-named root-linked unit", async () => {
    // Mirrors the two Runtherd definitions in BSData's Orks catalogue: a
    // stale shared model with no roster link, and a new standalone character.
    const catalogue = {
      catalogue: {
        id: "orks-cat",
        name: "Orks",
        library: false,
        sharedSelectionEntries: [
          { id: "orphan-runtherd", name: "Runtherd", type: "model", profiles: [] },
          {
            id: "standalone-runtherd",
            name: "Runtherd",
            type: "model",
            costs: [{ name: "pts", typeId: "51b2-306e-1021-d207", value: 10 }],
            categoryLinks: [
              { name: "Infantry" },
              { name: "Character" },
              { name: "Faction: Orks" },
              { name: "Support" },
            ],
          },
        ],
        entryLinks: [
          { id: "roster-runtherd", name: "Runtherd", targetId: "standalone-runtherd", type: "selectionEntry" },
        ],
      },
    };
    const blobs = new Map([
      ["game-system-sha", { gameSystem: { id: "system", name: "Warhammer 40,000 11th Edition" } }],
      ["orks-sha", catalogue],
    ]);
    vi.stubGlobal("fetch", async (url: string) => {
      const path = url.replace("https://api.github.com/", "");
      const data = path.endsWith("/git/trees/main?recursive=1")
        ? { tree: [
            { path: "Warhammer 40,000.json", sha: "game-system-sha", type: "blob" },
            { path: "Orks.json", sha: "orks-sha", type: "blob" },
          ] }
        : { content: Buffer.from(JSON.stringify(blobs.get(path.split("/").at(-1)!))).toString("base64") };
      return { ok: true, json: async () => data };
    });

    const { units } = await fetch11e();
    const runtherds = units.filter((unit) => unit.faction === "Orks" && unit.name === "Runtherd");

    expect(runtherds).toHaveLength(1);
    expect(runtherds[0]).toMatchObject({
      id: "roster-runtherd",
      points: 10,
      keywords: ["Infantry", "Character", "Orks", "Support"],
    });
  });
});

describe("11e catalogue-conditional content and wargear", () => {
  it("keeps a chapter-only rule on that chapter's copy of a shared datasheet, and resolves linked wargear", async () => {
    // Mirrors BSData/wh40k-11e: the Space Marines catalogue owns the Captain
    // (shared by every chapter via catalogueLink), whose "Templar Vows" rule
    // infoLink is hidden unless the primary catalogue is Black Templars.
    const gameSystem = {
      gameSystem: {
        id: "system",
        name: "Warhammer 40,000 11th Edition",
        sharedRules: [
          {
            id: "rule-vows",
            name: "Templar Vows",
            hidden: true,
            description: "Black Templars vow text.",
            modifiers: [
              {
                type: "set",
                field: "hidden",
                value: true,
                conditions: [{ type: "notInstanceOf", scope: "primary-catalogue", childId: "bt-cat", field: "selections", value: 1 }],
              },
            ],
          },
        ],
      },
    };
    const spaceMarines = {
      catalogue: {
        id: "sm-cat",
        name: "Imperium - Adeptus Astartes - Space Marines",
        library: false,
        sharedSelectionEntries: [
          { id: "w-bolter", name: "Master-crafted bolter", type: "upgrade", profiles: [{ id: "p-b", name: "Master-crafted bolter", typeId: "f77d-b953-8fa4-b762" }] },
          { id: "w-pistol", name: "Plasma pistol", type: "upgrade", profiles: [{ id: "p-p", name: "Plasma pistol", typeId: "f77d-b953-8fa4-b762" }] },
          {
            id: "captain",
            name: "Captain",
            type: "model",
            profiles: [{ id: "p-cap", name: "Captain", typeId: "c547-1836-d8a-ff4f" }],
            infoLinks: [{ id: "il-vows", name: "Templar Vows", targetId: "rule-vows", type: "rule" }],
            selectionEntryGroups: [
              {
                id: "g-ranged",
                name: "Ranged Weapon",
                defaultSelectionEntryId: "l-bolter",
                constraints: [
                  { type: "min", value: 1, field: "selections", scope: "parent" },
                  { type: "max", value: 1, field: "selections", scope: "parent" },
                ],
                entryLinks: [
                  { id: "l-bolter", name: "Master-crafted bolter", targetId: "w-bolter", type: "selectionEntry" },
                  { id: "l-pistol", name: "Plasma pistol", targetId: "w-pistol", type: "selectionEntry" },
                ],
              },
            ],
          },
        ],
        entryLinks: [{ id: "root-captain", name: "Captain", targetId: "captain", type: "selectionEntry" }],
      },
    };
    const blackTemplars = {
      catalogue: {
        id: "bt-cat",
        name: "Imperium - Adeptus Astartes - Black Templars",
        library: false,
        catalogueLinks: [{ id: "cl-sm", name: "Space Marines", targetId: "sm-cat", type: "catalogue" }],
      },
    };
    const blobs = new Map<string, unknown>([
      ["gs-sha", gameSystem],
      ["sm-sha", spaceMarines],
      ["bt-sha", blackTemplars],
    ]);
    vi.stubGlobal("fetch", async (url: string) => {
      const path = url.replace("https://api.github.com/", "");
      const data = path.endsWith("/git/trees/main?recursive=1")
        ? {
            tree: [
              { path: "Warhammer 40,000.json", sha: "gs-sha", type: "blob" },
              { path: "Imperium - Space Marines.json", sha: "sm-sha", type: "blob" },
              { path: "Imperium - Black Templars.json", sha: "bt-sha", type: "blob" },
            ],
          }
        : { content: Buffer.from(JSON.stringify(blobs.get(path.split("/").at(-1)!))).toString("base64") };
      return { ok: true, json: async () => data };
    });

    const { units } = await fetch11e();
    const captain = (faction: string) => units.find((u) => u.name === "Captain" && u.faction === faction);
    const sm = captain("Adeptus Astartes - Space Marines");
    const bt = captain("Adeptus Astartes - Black Templars");

    expect(sm?.abilities.map((a) => a.name)).not.toContain("Templar Vows");
    expect(bt?.abilities.map((a) => a.name)).toContain("Templar Vows");
    expect(sm?.unitSize).toEqual({ min: 1, max: 1 });
    expect(sm?.composition).toEqual([{ model: "Captain", min: 1, max: 1 }]);
    expect(sm?.wargear).toEqual([
      {
        model: "Captain",
        default: ["Master-crafted bolter"],
        options: ["Master-crafted bolter can be replaced with Plasma pistol"],
      },
    ]);
  });
});

// ── Linked content the 11e export used to drop (see each describe) ──

const RANGED = "f77d-b953-8fa4-b762";
const MELEE = "8a40-4aaa-c780-9046";
const UNIT_PROFILE = "c547-1836-d8a-ff4f";
const ABILITIES = "9cc3-6d83-4dd3-9b64";

const weaponChars = (range: string, skill: "BS" | "WS") => [
  { name: "Range", $text: range },
  { name: "A", $text: "1" },
  { name: skill, $text: "3+" },
  { name: "S", $text: "4" },
  { name: "AP", $text: "0" },
  { name: "D", $text: "1" },
  { name: "Keywords", $text: "-" },
];
const ability = (id: string, name: string, text: string) => ({
  id, name, typeId: ABILITIES, typeName: "Abilities", characteristics: [{ name: "Description", $text: text }],
});
const statLine = (id: string, name: string) => ({
  id, name, typeId: UNIT_PROFILE, typeName: "Unit",
  characteristics: [{ name: "M", $text: "6\"" }, { name: "T", $text: "4" }, { name: "Sv", $text: "3+" }],
});
/** Hidden unless `detachmentId` is in the roster: BSData's enhancement condition. */
const unlessDetachment = (detachmentId: string) => [
  { field: "hidden", type: "set", value: true, conditions: [{ type: "lessThan", value: 1, field: "selections", scope: "roster", childId: detachmentId }] },
];
const detachmentGroup = (entries: any[], subGroups: any[] = []) => ({
  id: "det-root", name: "Detachment", type: "upgrade",
  selectionEntryGroups: [{ id: "det-group", name: "Detachment", selectionEntries: entries, selectionEntryGroups: subGroups }],
});
const detachment = (id: string, name: string) => ({
  id, name, type: "upgrade", rules: [{ id: `${id}-rule`, name: `${name} rule`, description: `${name} rule text.` }],
});

/** Runs fetch11e over in-memory files: the game system plus `catalogues` (file name → JSON). */
async function run11e(catalogues: Record<string, unknown>, gameSystem: unknown = { gameSystem: { id: "system", name: "Warhammer 40,000 11th Edition" } }) {
  const files = new Map<string, unknown>([["Warhammer 40,000.json", gameSystem], ...Object.entries(catalogues)]);
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("https://api.github.com/", "");
    const data = path.endsWith("/git/trees/main?recursive=1")
      ? { tree: [...files.keys()].map((p) => ({ path: p, sha: encodeURIComponent(p), type: "blob" })) }
      : { content: Buffer.from(JSON.stringify(files.get(decodeURIComponent(path.split("/").at(-1)!)))).toString("base64") };
    return { ok: true, json: async () => data };
  });
  return fetch11e();
}

describe("11e weapons reached through a profile infoLink", () => {
  it("lists a shared weapon whose entry only links its profile, once per distinct profile", async () => {
    // Mirrors CSM Legionaries: the shared "Bolt pistol" upgrade has no inline
    // profile, just <infoLink type="profile"> to the catalogue's shared profile.
    const csm = {
      catalogue: {
        id: "csm", name: "Chaos - Chaos Space Marines", library: false,
        sharedProfiles: [{ id: "prof-bp", name: "Bolt pistol", typeId: RANGED, typeName: "Ranged Weapons", characteristics: weaponChars("12\"", "BS") }],
        sharedSelectionEntries: [
          { id: "w-bp", name: "Bolt pistol", type: "upgrade", infoLinks: [{ id: "il-bp", name: "Bolt pistol", targetId: "prof-bp", type: "profile" }] },
          {
            id: "legionaries", name: "Legionaries", type: "unit",
            selectionEntries: [
              { id: "champ", name: "Aspiring Champion", type: "model", profiles: [statLine("p-champ", "Aspiring Champion")],
                entryLinks: [{ id: "l-1", name: "Bolt pistol", targetId: "w-bp", type: "selectionEntry" }] },
              // The same profile linked again inline on another model: still one row.
              { id: "leg", name: "Legionary", type: "model",
                selectionEntries: [{ id: "w-bp2", name: "Bolt pistol", type: "upgrade", infoLinks: [{ id: "il-bp2", name: "Bolt pistol", targetId: "prof-bp", type: "profile" }] }] },
            ],
          },
        ],
        entryLinks: [{ id: "root-leg", name: "Legionaries", targetId: "legionaries", type: "selectionEntry" }],
      },
    };
    const { units } = await run11e({ "Chaos - Chaos Space Marines.json": csm });
    const leg = units.find((u) => u.name === "Legionaries")!;
    expect(leg.rangedWeapons.map((w) => w.name)).toEqual(["Bolt pistol"]);
    expect(leg.rangedWeapons[0].range).toBe("12\"");
  });
});

describe("11e catalogue profile types, infoGroups and reference tables", () => {
  it("reads custom-typed abilities, infoGroup abilities (not their rule glossary) and weapon-shaped custom types", async () => {
    const gameSystem = {
      gameSystem: {
        id: "system", name: "Warhammer 40,000 11th Edition",
        sharedRules: [{ id: "rule-lethal", name: "Lethal Hits", description: "Lethal Hits text." }],
      },
    };
    const cat = {
      catalogue: {
        id: "we", name: "Chaos - World Eaters", library: false,
        profileTypes: [{ id: "pt-wrath", name: "Wrathful Presence", characteristicTypes: [{ id: "c-eff", name: "Effect" }] }],
        sharedSelectionEntries: [
          {
            id: "angron", name: "Angron", type: "model",
            profiles: [
              statLine("p-angron", "Angron"),
              { id: "p-w1", name: "Overwhelming Wrath (Aura)", typeId: "pt-wrath", typeName: "Wrathful Presence", characteristics: [{ name: "Effect", $text: "Re-roll hits." }] },
              { id: "p-ctan", name: "Cosmic fire", typeId: "pt-ctan", typeName: "C'tan Powers", characteristics: weaponChars("24\"", "BS") },
            ],
            infoGroups: [{
              id: "ig", name: "Paladin's Duty (Bondsman)",
              profiles: [ability("p-duty", "Paladin's Duty (Bondsman)", "Lethal Hits for the bonded model.")],
              infoLinks: [{ id: "il-lh", name: "Lethal Hits", targetId: "rule-lethal", type: "rule" }],
            }],
          },
          {
            id: "ref", name: "Blessings of Khorne Reference", type: "upgrade",
            profiles: [{ id: "p-b1", name: "6. Cleaving Blows", typeId: "pt-bok", typeName: "Blessings of Khorne",
              characteristics: [{ name: "Roll", $text: "Double 6+" }, { name: "Effect", $text: "+1 AP in melee." }] }],
          },
          { id: "zerks", name: "Khorne Berzerkers", type: "unit", profiles: [statLine("p-z", "Khorne Berzerker"), ability("p-bok", "Blessings of Khorne", "Make a Blessings of Khorne roll.")] },
        ],
        entryLinks: [
          { id: "root-angron", name: "Angron", targetId: "angron", type: "selectionEntry" },
          { id: "root-zerks", name: "Khorne Berzerkers", targetId: "zerks", type: "selectionEntry" },
          { id: "root-ref", name: "Blessings of Khorne Reference", targetId: "ref", type: "selectionEntry" },
        ],
      },
    };
    const { units } = await run11e({ "Chaos - World Eaters.json": cat }, gameSystem);
    const angron = units.find((u) => u.name === "Angron")!;
    expect(angron.abilities).toContainEqual({ name: "Wrathful Presence: Overwhelming Wrath (Aura)", description: "Re-roll hits." });
    expect(angron.abilities.map((a) => a.name)).toContain("Paladin's Duty (Bondsman)");
    expect(angron.abilities.map((a) => a.name)).not.toContain("Lethal Hits");
    expect(angron.rangedWeapons.map((w) => w.name)).toEqual(["Cosmic fire"]);

    const blessings = units.find((u) => u.name === "Khorne Berzerkers")!.abilities.find((a) => a.name === "Blessings of Khorne")!;
    expect(blessings.description).toContain("Make a Blessings of Khorne roll.");
    expect(blessings.description).toContain("**6. Cleaving Blows**\n**Roll:** Double 6+\n**Effect:** +1 AP in melee.");
    // The reference entry itself is not a datasheet.
    expect(units.map((u) => u.name)).not.toContain("Blessings of Khorne Reference");
  });
});

describe("11e roster links", () => {
  it("adds the root entryLink's own categories to the unit's keywords (Titans)", async () => {
    const titans = {
      catalogue: {
        id: "titans", name: "Library - Titans", library: true,
        sharedSelectionEntries: [{ id: "warhound", name: "Warhound Titan", type: "model", profiles: [statLine("p-wh", "Warhound Titan")],
          categoryLinks: [{ id: "c1", name: "Vehicle", targetId: "cat-vehicle" }, { id: "c2", name: "Titanic", targetId: "cat-titanic" }] }],
      },
    };
    const traitoris = {
      catalogue: {
        id: "tt", name: "Chaos - Titanicus Traitoris", library: false,
        catalogueLinks: [{ id: "cl", name: "Library - Titans", targetId: "titans", type: "catalogue" }],
        entryLinks: [{ id: "root-wh", name: "Warhound Titan", targetId: "warhound", type: "selectionEntry",
          categoryLinks: [{ id: "c3", name: "Faction: Titanicus Traitoris", targetId: "cat-tt" }, { id: "c4", name: "Chaos", targetId: "cat-chaos" }] }],
      },
    };
    const { units } = await run11e({ "Library - Titans.json": titans, "Chaos - Titanicus Traitoris.json": traitoris });
    const warhound = units.find((u) => u.name === "Warhound Titan" && u.faction === "Titanicus Traitoris")!;
    expect(warhound.keywords).toEqual(["Vehicle", "Titanic", "Titanicus Traitoris", "Chaos"]);
  });

  it("reads a root-linked 'upgrade' that carries its own stat line as a datasheet (X-101)", async () => {
    const admech = {
      catalogue: {
        id: "am", name: "Imperium - Adeptus Mechanicus", library: false,
        sharedSelectionEntries: [
          { id: "x101", name: "X-101 [Legends]", type: "upgrade", profiles: [statLine("p-x", "X-101")], categoryLinks: [{ id: "k", name: "Character", targetId: "cat-char" }] },
          // An ordinary root-linked upgrade without a stat line stays out.
          { id: "relic", name: "Some Upgrade", type: "upgrade", profiles: [ability("p-r", "Some Upgrade", "Text.")] },
        ],
        entryLinks: [
          { id: "root-x", name: "X-101 [Legends]", targetId: "x101", type: "selectionEntry" },
          { id: "root-r", name: "Some Upgrade", targetId: "relic", type: "selectionEntry" },
        ],
      },
    };
    const { units } = await run11e({ "Imperium - Adeptus Mechanicus.json": admech });
    expect(units.map((u) => u.name)).toEqual(["X-101 [Legends]"]);
    expect(units[0].profiles[0].name).toBe("X-101");
  });
});

describe("11e enhancements and their detachments", () => {
  it("finds unit-level enhancements and names every enhancement's detachment from the data's own condition", async () => {
    const votann = {
      catalogue: {
        id: "lov", name: "Leagues of Votann", library: false,
        sharedSelectionEntries: [
          detachmentGroup([detachment("det-at", "Armoured Trailblazers"), detachment("det-hk", "Hearthfyre Arsenal")]),
          {
            id: "sagitaur", name: "Sagitaur", type: "unit", profiles: [statLine("p-s", "Sagitaur")],
            selectionEntryGroups: [{
              id: "g-enh", name: "Enhancements", modifiers: unlessDetachment("det-at"),
              selectionEntries: [{ id: "e-sat", name: "Saturation Rounds", type: "upgrade", costs: [{ name: "pts", typeId: "51b2-306e-1021-d207", value: 15 }],
                profiles: [ability("p-sat", "Saturation Rounds", "This unit's ranged attacks have [IGNORES COVER].")] }],
            }],
            entryLinks: [{
              // A link to the shared Enhancements group that adds an entry of its own (Chaos Knights' War Dog Huntsman).
              id: "l-enh", name: "Enhancements", targetId: "g-shared", type: "selectionEntryGroup",
              selectionEntries: [{ id: "e-link", name: "Linked Upgrade", type: "upgrade", modifiers: unlessDetachment("det-hk"),
                profiles: [ability("p-link", "Linked Upgrade", "Linked text.")] }],
            }],
          },
        ],
        sharedSelectionEntryGroups: [{
          id: "g-shared", name: "Enhancements",
          selectionEntryGroups: [{
            id: "g-hk", name: "Hearthfyre Enhancements",
            selectionEntries: [
              // The comment is a short name; the condition names the detachment.
              { id: "e-short", name: "Short Comment", type: "upgrade", comment: "Hearthfyre", modifiers: unlessDetachment("det-hk"),
                profiles: [ability("p-short", "Short Comment", "Text.")] },
              // A weapon enhancement (AdMech's TL-409): its profile is the rules text.
              { id: "e-gun", name: "TL-409", type: "upgrade", modifiers: unlessDetachment("det-hk"),
                profiles: [{ id: "p-gun", name: "TL-409", typeId: RANGED, typeName: "Ranged Weapons", characteristics: weaponChars("24\"", "BS") }] },
            ],
          }],
        }],
        entryLinks: [{ id: "root-s", name: "Sagitaur", targetId: "sagitaur", type: "selectionEntry" }],
      },
    };
    const { enhancements } = await run11e({ "Leagues of Votann.json": votann });
    const byName = Object.fromEntries(enhancements.map((e) => [e.name, e]));
    expect(byName["Saturation Rounds"]).toMatchObject({ detachment: "Armoured Trailblazers", points: 15 });
    expect(byName["Linked Upgrade"].detachment).toBe("Hearthfyre Arsenal");
    expect(byName["Short Comment"].detachment).toBe("Hearthfyre Arsenal");
    expect(byName["TL-409"].description).toBe("**TL-409** (ranged weapon): Range 24\", A 1, BS 3+, S 4, AP 0, D 1");
    expect(enhancements.every((e) => !("detachmentId" in e))).toBe(true);
  });

  it("files a shared library's enhancements under the faction that has their detachment, and reads nested detachment groups", async () => {
    // Mirrors "Library - Tyranids", which holds Genestealer Cults' detachments and
    // enhancements too; and Custodes' "Shield Host Detachments" nested group.
    const library = {
      catalogue: {
        id: "lib", name: "Library - Tyranids", library: true,
        sharedSelectionEntries: [detachmentGroup([detachment("det-inv", "Invasion Fleet")], [
          { id: "nested", name: "Shield Host Detachments (Max 1)", selectionEntries: [detachment("det-bba", "Brood Brother Auxilia")] },
        ])],
        sharedSelectionEntryGroups: [{
          id: "g-enh", name: "Enhancements",
          selectionEntries: [
            { id: "e-nid", name: "Nid Enhancement", type: "upgrade", modifiers: unlessDetachment("det-inv"), profiles: [ability("p1", "Nid Enhancement", "A.")] },
            { id: "e-gsc", name: "Cult Enhancement", type: "upgrade", modifiers: unlessDetachment("det-bba"), profiles: [ability("p2", "Cult Enhancement", "B.")] },
          ],
        }],
      },
    };
    const tyranids = {
      catalogue: { id: "nids", name: "Xenos - Tyranids", library: false, catalogueLinks: [{ id: "cl1", name: "Library - Tyranids", targetId: "lib", type: "catalogue" }] },
    };
    const gsc = {
      catalogue: {
        id: "gsc", name: "Xenos - Genestealer Cults", library: false,
        catalogueLinks: [{ id: "cl2", name: "Library - Tyranids", targetId: "lib", type: "catalogue" }],
        sharedSelectionEntries: [{ id: "gsc-det", name: "Detachment", type: "upgrade",
          entryLinks: [{ id: "l-det", name: "Detachment", targetId: "gsc-group", type: "selectionEntryGroup" }] }],
        sharedSelectionEntryGroups: [{ id: "gsc-group", name: "Detachment", selectionEntries: [detachment("det-bba", "Brood Brother Auxilia")] }],
      },
    };
    const { detachments, enhancements } = await run11e({
      "Library - Tyranids.json": library, "Tyranids.json": tyranids, "Genestealer Cults.json": gsc,
    });
    expect(detachments.filter((d) => d.faction === "Tyranids").map((d) => d.name)).toEqual(["Invasion Fleet", "Brood Brother Auxilia"]);
    const of = (faction: string) => enhancements.filter((e) => e.faction === faction).map((e) => `${e.name} / ${e.detachment}`);
    expect(of("Genestealer Cults")).toEqual(["Cult Enhancement / Brood Brother Auxilia"]);
    // Tyranids' own library also nests the cult detachment here, so it keeps both.
    expect(of("Tyranids")).toEqual(["Nid Enhancement / Invasion Fleet", "Cult Enhancement / Brood Brother Auxilia"]);
  });

  it("falls back to an enclosing group's comment when no condition names the detachment", async () => {
    const dg = {
      catalogue: {
        id: "dg", name: "Chaos - Death Guard", library: false,
        sharedSelectionEntries: [detachmentGroup([detachment("det-ce", "Contagion Engines")])],
        sharedSelectionEntryGroups: [{
          id: "g", name: "Enhancements", comment: "Contagion Engines",
          selectionEntries: [{ id: "e-l", name: "Lancet of the Worldsore", type: "upgrade", profiles: [ability("p", "Lancet of the Worldsore", "Text.")] }],
        }],
      },
    };
    const { enhancements } = await run11e({ "Chaos - Death Guard.json": dg });
    expect(enhancements.map((e) => e.detachment)).toEqual(["Contagion Engines"]);
  });
});
