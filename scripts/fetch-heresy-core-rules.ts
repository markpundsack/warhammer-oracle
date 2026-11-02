/**
 * Fetch the Horus Heresy 3rd Edition core rules from Wahapedia and generate
 * src/data/heresy-core-rules.ts: the turn sequence, statuses, core Reactions
 * and Gambits, principles of combat, army building (detachments, the Crusade
 * Force Organisation Chart) and the core missions.
 *
 * BSData/horus-heresy-3rd-edition carries unit data and special rules, but not
 * the core rulebook, so this is the one Heresy source outside BSData (the 40K
 * stratagem baselines already cite Wahapedia the same way).
 *
 * Usage: npx tsx scripts/fetch-heresy-core-rules.ts
 *        npx tsx scripts/fetch-heresy-core-rules.ts --html-dir=/path/to/saved/pages   (offline: <page>.html files)
 *
 * Wahapedia's robots.txt allows /heresy3/ (it disallows /heresy3_/). Pages are
 * fetched one at a time with a pause between them.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HeresyRuleKind, HeresySpecialRule } from "../src/types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://wahapedia.ru/heresy3/the-rules";

export const CORE_RULE_PAGES = [
  { slug: "the-rules-of-battle", title: "The Rules of Battle" },
  { slug: "principles-of-combat", title: "Principles of Combat" },
  { slug: "battles-in-the-age-of-darkness", title: "Battles in the Age of Darkness" },
] as const;

// === HTML → sections ===

const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "source", "wbr", "col", "area", "base"]);
/** Elements dropped with everything inside them: scripts, ads, tooltip glossaries, flavour text, the contents box. */
const SKIP_TAGS = new Set(["script", "style", "noscript", "svg", "iframe", "button", "select"]);
const SKIP_CLASS = /\b(tooltip_templates|page_ads\w*|ShowFluff|legend2|noprint|contents_header|NavColumns\d|img-inv|BreakInsideAvoid_hide)\b/;
/** Headings that are site furniture, not rules. */
const NOT_RULES = new Set(["books", "disable ads", "contents"]);

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", times: "×", deg: "°", bull: "•", middot: "·",
};
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const CELL = "\u0001";
/** Bold open/close markers while tokenizing; turned into "**" by `tidy` once the boundaries are sorted out. */
const B_OPEN = "\u0002";
const B_CLOSE = "\u0003";
/** A bold run that labels what follows: "Cost:", "Flurry of Blows –", a dice range "3-4", "1 or 6". */
const LABEL = /^\s*(?:[^\u0002\u0003\n]{1,60}?(?::|\s[–-])|\d+(?:\s*(?:[-–]|or)\s*\d+)?\+?)\s*$/;

/** Raw text with light markdown: **bold**, "- " list items, table rows as "a | b". */
function tidy(raw: string): string {
  let t = raw
    .split("\n")
    .map((line) => {
      const l = line.replace(/[ \t]+/g, " ").trim();
      if (!l.includes(CELL)) return l;
      return l.split(CELL).map((c) => c.trim()).filter(Boolean).join(" | ");
    })
    .join("\n");
  t = t
    .replace(/\u0002\s*\u0003/g, " ") // empty bold
    .replace(/\u0002(\s+)/g, "$1\u0002") // move edge whitespace outside the bold
    .replace(/(\s+)\u0003/g, "\u0003$1");
  // a bold label starts a new paragraph ("…Control.<b>Cost:</b>", "<b>Summary.</b> <b>Trigger:</b>")
  t = t.replace(/([^\n])\s*\u0002([^\u0002\u0003]*)\u0003/g, (m, before: string, inner: string) =>
    LABEL.test(inner) ? `${before}\n\n\u0002${inner}\u0003` : m,
  );
  return t
    .replace(/\u0003[ \t]*\u0002/g, " ") // two plain bold runs side by side (same line) are one
    .replace(/[\u0002\u0003]/g, "**")
    // image-only links ("See full Crusade Force Organisation Chart diagram.")
    .replace(/See full\s+[^\n]*?\s*diagram\.?/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type RawSection = { anchor: string; level: number; title: string; text: string };

/** Split a Wahapedia rules page into its anchored sections (`<a name="X"></a><hN id="X">Title</hN>` … up to the next one). */
export function splitSections(html: string): RawSection[] {
  const body = html.slice(Math.max(0, html.indexOf("<body")));
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  let pendingAnchor = "";
  let inHeading = 0;
  let headingText = "";
  let skip: { tag: string; depth: number } | null = null;
  let out = "";
  const emit = (s: string) => {
    if (inHeading) headingText += s;
    else if (current) out += s;
  };
  const close = () => {
    if (current) {
      current.text = tidy(out);
      sections.push(current);
    }
    out = "";
  };
  for (let m: RegExpExecArray | null; (m = re.exec(body)); ) {
    if (m[0].startsWith("<!--")) continue;
    const text = m[4];
    if (text !== undefined) {
      if (!skip) emit(decode(text).replace(/\s+/g, " "));
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3] ?? "";
    if (skip) {
      if (tag === skip.tag && !VOID.has(tag)) skip.depth += closing ? -1 : attrs.trimEnd().endsWith("/") ? 0 : 1;
      if (skip.depth === 0) skip = null;
      continue;
    }
    if (!closing && !VOID.has(tag)) {
      const cls = attrs.match(/class\s*=\s*"([^"]*)"/i)?.[1] ?? "";
      if (SKIP_TAGS.has(tag) || SKIP_CLASS.test(cls) || /display\s*:\s*none/i.test(attrs)) {
        skip = { tag, depth: 1 };
        continue;
      }
    }
    if (tag === "a" && !closing) {
      const name = attrs.match(/\bname\s*=\s*"([^"]+)"/i)?.[1];
      if (name) pendingAnchor = name;
      continue;
    }
    const h = tag.match(/^h([1-6])$/);
    if (h) {
      if (!closing && pendingAnchor) {
        close();
        current = { anchor: pendingAnchor, level: Number(h[1]), title: "", text: "" };
        pendingAnchor = "";
        inHeading = Number(h[1]);
        headingText = "";
      } else if (closing && inHeading === Number(h[1])) {
        if (current) current.title = decode(headingText).replace(/\s+/g, " ").trim();
        inHeading = 0;
      } else if (!closing) {
        emit(`\n\n${B_OPEN}`); // an un-anchored sub-heading: keep it as a bold line
      } else {
        emit(`${B_CLOSE}\n\n`);
      }
      continue;
    }
    switch (tag) {
      case "br":
        emit("\n");
        break;
      case "p":
      case "div":
      case "ul":
      case "ol":
      case "table":
        emit("\n");
        break;
      case "li":
        if (!closing) emit("\n- ");
        break;
      case "tr":
        emit("\n");
        break;
      case "td":
      case "th":
        if (!closing) emit(CELL);
        break;
      case "b":
      case "strong":
        emit(closing ? B_CLOSE : B_OPEN);
        break;
    }
  }
  close();
  return sections.filter((s) => s.title && !NOT_RULES.has(s.title.toLowerCase()));
}

// === Sections → rules ===

function titleCase(s: string): string {
  // "THE CORE RULES" → "The Core Rules"; mixed-case titles are left alone
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

/** Alternate names a player would say: "Movement Phase: Reposition" → "Reposition"; "1. Declare Target" → "Declare Target"; "The Start Phase" → "Start Phase". */
function aliasesFor(title: string): string[] {
  const out = new Set<string>();
  const colon = title.match(/^[^:]+:\s*(.+)$/);
  if (colon) out.add(colon[1]);
  const numbered = title.match(/^\d+\.\s*(.+)$/);
  if (numbered) out.add(numbered[1]);
  const the = title.match(/^The\s+(.+)$/i);
  if (the) out.add(the[1]);
  out.delete(title);
  return [...out];
}

function kindFor(page: string, path: string[], title: string): HeresyRuleKind {
  const p = path.map((x) => x.toLowerCase());
  const t = title.toLowerCase();
  if (p.includes("tactical statuses") || /\bstatus$/.test(t)) return "status";
  if (p.includes("core reactions") || p.includes("advanced reactions") || /^advanced reaction:/.test(t)) return "reaction";
  if (p.includes("core gambits")) return "gambit";
  if (page === "battles-in-the-age-of-darkness") {
    if (p.some((x) => /detachment|organisation chart|armies in the age|army selection/.test(x)) || /detachment|organisation chart|battlefield roles|prime slots|warlord/.test(t)) {
      return "detachment";
    }
    return "mission";
  }
  return "core rule";
}

/** "**Summary.**\n\nBody" → "Summary." */
function leadingBold(text: string): string {
  const m = text.match(/^\s*\*\*([^*]+?)\*\*/);
  if (!m || LABEL.test(m[1])) return ""; // "**Seize the Initiative –**" labels a list item; it isn't a summary
  return m[1].replace(/\s+/g, " ").trim();
}

export function sectionsToRules(slug: string, pageTitle: string, sections: RawSection[]): HeresySpecialRule[] {
  const out: HeresySpecialRule[] = [];
  const stack: { level: number; title: string; rule: HeresySpecialRule | null }[] = [];
  for (const raw of sections) {
    // Wahapedia marks "Challenge Sub-Phase" up as a top-level heading, which would nest the Fight and
    // Resolution Sub-Phases under it: a sub-phase always sits one level under its phase.
    const s = /sub-phase$/i.test(raw.title) && raw.level === 2 ? { ...raw, level: 3 } : raw;
    while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop();
    const title = titleCase(s.title);
    const path = stack.map((x) => x.title);
    const kind = kindFor(slug, path, title);
    const summary = leadingBold(s.text);
    const rule: HeresySpecialRule = {
      name: title,
      aliases: aliasesFor(title),
      summary,
      description: s.text,
      source: "Horus Heresy 3rd Edition core rules",
      gameSystem: "horus-heresy-3e",
      kind,
      context: [pageTitle, ...path].join(" > "),
      url: `${BASE}/${slug}/#${s.anchor}`,
    };
    // a parent section lists what it covers, so "the Charge Sub-Phase" answers with its steps
    const parent = stack[stack.length - 1]?.rule;
    if (parent) parent.description += `${parent.description.includes("\n\n**Covers:**") ? "" : "\n\n**Covers:**"}\n- ${title}`;
    out.push(rule);
    stack.push({ level: s.level, title, rule });
    // "Core Gambits" is one section listing every Gambit as "**Name –** text": give each its own entry
    if (/gambits$/i.test(title)) {
      for (const m of s.text.matchAll(/\*\*([^*\n]+?)\s*[–-]\s*\*\*\s*([^]*?)(?=\n\n\*\*[^*\n]+?\s*[–-]\s*\*\*|$)/g)) {
        const gambit = m[1].trim();
        const text = m[2].trim();
        out.push({
          name: gambit,
          aliases: [],
          summary: "",
          description: text,
          source: rule.source,
          gameSystem: "horus-heresy-3e",
          kind: "gambit",
          context: [pageTitle, ...path, title].join(" > "),
          url: rule.url,
        });
      }
    }
  }
  // Drop empty shells (a heading with no text and nothing under it).
  return out.filter((r) => r.description.trim());
}

// === Main ===

function cliOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function fetchPage(slug: string): Promise<string> {
  const res = await fetch(`${BASE}/${slug}/`, { headers: { "User-Agent": "warhammer-oracle (rules reference; github.com/gregario/warhammer-oracle)" } });
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const htmlDir = cliOption("html-dir");
  const rules: HeresySpecialRule[] = [];
  for (const [i, page] of CORE_RULE_PAGES.entries()) {
    if (!htmlDir && i > 0) await new Promise((r) => setTimeout(r, 3000));
    const html = htmlDir ? readFileSync(join(htmlDir, `${page.slug}.html`), "utf-8") : await fetchPage(page.slug);
    const pageRules = sectionsToRules(page.slug, page.title, splitSections(html));
    console.log(`${page.slug}: ${pageRules.length} sections`);
    rules.push(...pageRules);
  }
  const path = join(ROOT, "src", "data", "heresy-core-rules.ts");
  writeFileSync(
    path,
    [
      "// Auto-generated by scripts/fetch-heresy-core-rules.ts — do not edit manually",
      `// Generated: ${new Date().toISOString()}`,
      `// Source: ${BASE}/ (Wahapedia; the core rulebook is not in BSData)`,
      "",
      'import type { HeresySpecialRule } from "../types.js";',
      "",
      `export const HERESY_CORE_RULES: HeresySpecialRule[] = ${JSON.stringify(rules, null, 2)};`,
      "",
    ].join("\n"),
    "utf-8",
  );
  console.log(`Wrote ${path} (${rules.length} core rule sections)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
