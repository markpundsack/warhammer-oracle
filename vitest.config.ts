import { defineConfig } from "vitest/config";

export default defineConfig({
  // GW's FAQ and faction-pack files are personal-use and outside git (src/lib/heresy-faq.ts,
  // src/lib/private-errata.ts): tests run without them.
  test: { env: { HERESY_FAQ_OFFICIAL: "none", PACK_ERRATA_11E: "none" } },
});
