import { describe, it, expect } from "vitest";
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
