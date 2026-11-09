/** Searching GW's official 11th Edition updates and FAQ rulings (src/data/faq-11e.ts). */
import { FAQ_11E, FAQ_SOURCES, type Faq11eEntry } from "../data/faq-11e.js";
import { stratagemFactionLabel } from "../data/stratagem-sources.js";
import { buildFaqSearch } from "./faq-search.js";
import { attachRulings, registerFaqSource } from "./faq-attach.js";

const search = buildFaqSearch(FAQ_11E, "warhammer 40k 40000 official faq ruling errata update");

/** Rulings closest to a question. With a faction, that faction's rulings and the universal ones. */
export function searchFaq11e(query: string, faction?: string, limit = 3): { entry: Faq11eEntry; score: number }[] {
  const label = faction ? stratagemFactionLabel(faction) : undefined;
  return search(query, limit, label ? (e) => !e.faction || e.faction === label : undefined);
}

function formatEntry(e: Faq11eEntry): string {
  const source = FAQ_SOURCES[e.source];
  return `**Q:** ${e.question}\n**A:** ${e.answer}\n_${source.label}: ${source.url}_`;
}

export function formatFaq11eSearch(query: string, faction?: string): string {
  const hits = searchFaq11e(query, faction);
  if (!hits.length) {
    return `No official update or FAQ ruling matches "${query}"${faction ? ` for ${faction}` : ""}. The ${FAQ_11E.length} rulings here don't cover it, so answer from the rule itself (lookup_keyword, lookup_stratagem) and say no specific ruling was found.`;
  }
  const best = hits[0].score;
  return [
    `# Warhammer 40,000 11th Edition: closest official rulings to "${query}"`,
    ...hits.map((h, i) => `## ${i + 1}.${i === 0 && best >= 0.6 ? "" : " (possibly related)"}\n\n${formatEntry(h.entry)}`),
    "_Summaries of GW's published updates and FAQs. Answer from one only if it is clearly the same question, and name the source._",
  ].join("\n\n");
}

// 40K rulings can come along with any lookup's answer (src/lib/faq-attach.ts).
registerFaqSource("40k", {
  search: (query, limit) => search(query, limit),
  army: (e: Faq11eEntry) => e.faction,
  sameArmy: (e: Faq11eEntry, army: string) => e.faction === stratagemFactionLabel(army),
  format: formatEntry,
});

/** Rulings about a named rule, for appending to its answer. */
export function faqFor(ruleName: string, faction?: string, limit = 2): string {
  return attachRulings({ system: "40k", names: [ruleName], army: faction, limit });
}
