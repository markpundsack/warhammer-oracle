import { describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

describe("private faction-pack errata", () => {
  it("replaces records by position only when the name still matches", async () => {
    vi.resetModules();
    vi.stubEnv("PACK_ERRATA_11E", fileURLToPath(new URL("./fixtures/pack-errata.json", import.meta.url)));
    const { applyPackErrata } = await import("../src/lib/private-errata.js");
    const recs = [{ name: "Smoke" }, { name: "Other" }];
    expect(applyPackErrata("stratagems", recs)).toEqual([{ name: "Smoke" }, { name: "Other" }]);
    vi.unstubAllEnvs();
  });

  it("applies a matching record", async () => {
    vi.resetModules();
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "errata-")), "e.json");
    fs.writeFileSync(file, JSON.stringify({ units: [{ i: 1, name: "B", record: { name: "B", fixed: true } }] }));
    vi.stubEnv("PACK_ERRATA_11E", file);
    const { applyPackErrata } = await import("../src/lib/private-errata.js");
    expect(applyPackErrata("units", [{ name: "A" }, { name: "B" }])[1]).toEqual({ name: "B", fixed: true });
    vi.unstubAllEnvs();
  });

  it("serves nothing extra without the file (PACK_ERRATA_11E=none)", async () => {
    vi.resetModules();
    const { applyPackErrata } = await import("../src/lib/private-errata.js");
    const recs = [{ name: "A" }];
    expect(applyPackErrata("units", recs)).toBe(recs);
  });
});
