import { defineConfig } from "vitest/config";

export default defineConfig({
  // GW's FAQ file is personal-use and outside git (src/lib/heresy-faq.ts): tests run without it.
  test: { env: { HERESY_FAQ_OFFICIAL: "none" } },
});
