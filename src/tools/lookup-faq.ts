import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatFaq11eSearch } from "../lib/faq-11e.js";

export function registerLookupFaq(server: McpServer): void {
  server.tool(
    "lookup_faq",
    "Search Games Workshop's official Warhammer 40,000 11th Edition rulings by question. Use it whenever a player asks about an FAQ, a ruling, an errata " +
      "or a rules update, or how two rules interact, and check it for edge cases the rule's own text doesn't settle. Covers the Universal Rules Updates " +
      "(free stratagems, using a stratagem twice, ranged-targeting limits, stratagems that replace destroyed units, disembark move types), " +
      "the Chapter Approved mission deck FAQ and event rules from the Event Companion (secondary and primary mission cards, operation markers, VP limits, " +
      "event CP cap, tournament pairing), every faction pack's FAQ, and the Space Marines and Custodes Codex updates. " +
      "Examples: 'does the 15VP limit apply at the end of the battle?', 'can I pick a new Beacon unit?', " +
      "'can Tyranids use Insane Bravery against Shadow in the Warp?'. Returns the closest rulings and their source. " +
      "For Horus Heresy rulings use heresy_faq; for a rule's own text use lookup_keyword or lookup_stratagem.",
    {
      question: z.string().describe("The rules question, in the player's words. Name the unit, stratagem or mission involved."),
      faction: z
        .string()
        .optional()
        .describe("Optional army, e.g. 'Tyranids', 'Chaos Space Marines'. Limits results to that army's rulings plus the universal ones."),
    },
    async ({ question, faction }) => ({ content: [{ type: "text" as const, text: formatFaq11eSearch(question, faction) }] }),
  );
}
