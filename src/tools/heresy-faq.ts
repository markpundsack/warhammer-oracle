import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatFaqSearch } from "../lib/heresy-faq.js";

export function registerHeresyFaq(server: McpServer): void {
  server.tool(
    "heresy_faq",
    "Search the official Horus Heresy (3rd edition) FAQ rulings by question, e.g. 'can vehicles be engaged in combat?', " +
      "'does Orbital Assault Vehicle count towards the Deep Strike limit?'. Returns the closest rulings with their answers.",
    { question: z.string().describe("The rules question, in the player's words") },
    async ({ question }) => ({ content: [{ type: "text" as const, text: formatFaqSearch(question) }] }),
  );
}
