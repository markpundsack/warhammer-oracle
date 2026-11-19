/**
 * Fetch BSData/wh40k-10e, BSData/wh40k-11e, BSData/wh40k-killteam and
 * BSData/horus-heresy-3rd-edition data and generate embedded TypeScript data
 * files.
 *
 * Usage: npx tsx scripts/fetch-data.ts
 *        npx tsx scripts/fetch-data.ts --only=heresy             (one system: 40k10e, 40k11e, killteam, heresy)
 *        npx tsx scripts/fetch-data.ts --only=heresy --heresy-dir=/path/to/horus-heresy-3rd-edition
 *          (read a local clone instead of the GitHub API)
 *
 * Uses the public GitHub REST API directly (no `gh` CLI required). Set
 * GITHUB_TOKEN to raise the rate limit above the 60 req/hr anonymous cap
 * (GitHub Actions provides this automatically).
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseKillTeamGameSystem,
  parseKillTeamCatalogue,
  parseDetachments,
  collectEnhancements,
  parseGenericCrusadeHonours,
  parseFactionCrusadeHonours,
  buildRuleIndex,
  buildProfileIndex,
  xmlParser,
  ensureArray,
  parseEntryNode,
  extractFaction,
  normalizeJsonNode,
  ruleLinksToAbilityProfiles,
  weaponProfileLinks,
  noteWeaponRules,
  infoGroupContents,
  referenceTables,
  withLinkedUnitProfile,
  isHiddenIn,
  isLinkHiddenIn,
  collectDynamicCategoryIds,
} from "../src/lib/xml-parser.js";
import type { VisibilityEnv, ParsedEnhancement } from "../src/lib/xml-parser.js";
import { parseHeresyData } from "../src/lib/heresy-parser.js";
import type { HeresySourceFile, HeresyParseResult } from "../src/lib/heresy-parser.js";
import type { Unit, Detachment, Enhancement, CrusadeHonour, KillTeamOperative } from "../src/types.js";

/** The game system's own rules (core weapon abilities), by id and lower-case name: exported once as shared rules,
 * never per weapon (noteWeaponRules). */
const GAME_SYSTEM_RULE_IDS = new Set<string>();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const REPO_40K = "BSData/wh40k-10e";
const REPO_40K_11E = "BSData/wh40k-11e";
const REPO_KT = "BSData/wh40k-killteam";
const REPO_HERESY = "BSData/horus-heresy-3rd-edition";

/** BattleScribe's Unit (stat line) profile type, shared by wh40k-10e and wh40k-11e. */
const UNIT_PROFILE_TYPE_ID = "c547-1836-d8a-ff4f";

// ── GitHub API helpers ───────────────────────────────────────────────────

interface TreeEntry {
  path: string;
  sha: string;
}

async function ghApi(path: string): Promise<any> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com/${path}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchTree(repo: string, branch = "main"): Promise<TreeEntry[]> {
  const data = await ghApi(`repos/${repo}/git/trees/${branch}?recursive=1`);
  const tree = (data.tree ?? []) as Array<{ path: string; sha: string; type: string }>;
  return tree
    .filter((e) => e.type === "blob" && /\.(cat|gst|json)$/.test(e.path))
    .map((e) => ({ path: e.path, sha: e.sha }));
}

async function fetchBlob(repo: string, sha: string): Promise<string> {
  const data = await ghApi(`repos/${repo}/git/blobs/${sha}`);
  // A short delay avoids tripping GitHub's secondary (burst) rate limit,
  // which is separate from — and much stricter than — the hourly quota.
  await new Promise((resolve) => setTimeout(resolve, 200));
  return Buffer.from(data.content as string, "base64").toString("utf-8");
}

// BSData catalogues often ship as a thin "roster" file plus a same-named
// "Library" file holding the faction's actual detachments/units (e.g.
// "Chaos - Chaos Daemons.json" catalogueLinks into "Chaos - Chaos Daemons
// Library.json", which is where Daemons' own Detachment group actually
// lives). That's the only case where following a catalogueLink to source
// detachments/enhancements is correct. The same library files are ALSO
// catalogueLinked by many unrelated factions purely to grant access to
// allied units (e.g. every Space Marine chapter links "Imperial Knights -
// Library" so a Marines army can include Knight allies) — walking those
// links for detachments/enhancements too would wrongly attribute another
// faction's entire detachment list to the importing faction. This checks
// whether a linked library "belongs" to the importing catalogue's own
// faction (by name), which is the only signal available — BattleScribe's
// `importRootEntries` flag doesn't distinguish the two cases (it's `true`
// on both a faction's own library link and its ally-unit library links).
//
// Match is substring-based, not exact: BSData's own filename and internal
// `name` attribute disagree for at least one library ("Chaos - Chaos
// Daemons Library.json"'s filename vs. its internal name "Chaos - Daemons
// Library", missing the repeated "Chaos") — exact string equality rejected
// that as a false mismatch and silently dropped Chaos Daemons' own 9
// detachments. Substring matching tolerates that inconsistency while still
// correctly rejecting unrelated pairs (e.g. "chaos space marines" contains
// neither "chaos knights" nor "daemons", and vice versa).
function libraryBelongsToFaction(catalogueName: string, libraryName: string): boolean {
  const stripToFaction = (name: string) =>
    extractFaction(name)
      .replace(/\s*-?\s*Library$/i, "")
      .trim()
      .toLowerCase();
  const a = stripToFaction(catalogueName);
  const b = stripToFaction(libraryName);
  return a === b || a.includes(b) || b.includes(a);
}

// ── Fetch 40K data (with cross-catalogue entryLink resolution) ──────────
// Shared between BSData/wh40k-10e (XML) and BSData/wh40k-11e (JSON) — both
// repos use the same underlying BattleScribe catalogue schema, just a
// different file encoding, so `parseNode` is the only thing that varies.

interface ParsedCatalogue {
  id: string;
  name: string;
  isLibrary: boolean;
  raw: any; // parsed catalogue node, normalized to the XML-parser shape
}

async function fetchCatalogueRepo(
  repo: string,
  gameSystemFiles: TreeEntry[],
  catFiles: TreeEntry[],
  parseNode: (raw: string) => any,
  gameSystem: "wh40k-10e" | "wh40k-11e",
  // Crusade Honours (Battle Traits/Relics/Battle Scars/Boons) are only
  // extracted for wh40k-11e — see CrusadeHonour's doc comment in types.ts
  // for why this mirrors the DetachmentPoints/Disposition 11e-only scoping.
  extractCrusade = false,
): Promise<{
  units: Unit[];
  detachments: Detachment[];
  enhancements: Enhancement[];
  crusadeHonours: CrusadeHonour[];
  rules: { name: string; description: string }[];
}> {
  // ── Phase 0: Parse game system file(s) for rules ──
  const allRules: { name: string; description: string }[] = [];
  const allCrusadeHonours: CrusadeHonour[] = [];
  // Also build a global shared entry index from the game system file
  const globalSharedIndex = new Map<string, any>();
  // Global rule index (by id), for resolving infoLinks in detachment and unit
  // entries. Populated here from the game system file's own rules/sharedRules
  // — where universal core abilities like Deep Strike, Infiltrators, and Scouts
  // actually live — then extended per-catalogue below.
  const globalRuleIndex = new Map<string, any>();
  // Global profile index (by id) — the profile-based counterpart to
  // globalRuleIndex, for resolving <infoLink type="profile"> (see
  // ruleLinksToAbilityProfiles in xml-parser.ts). Confirmed via BSData/
  // wh40k-10e: Adeptus Custodes' Custodian Guard references its wargear
  // abilities ("Praesidium Shield", "Vexilla") this way, not via a rule
  // infoLink — without this, those abilities were silently dropped entirely.
  const globalProfileIndex = new Map<string, any>();
  const gameSystemNodes: any[] = [];

  for (const gst of gameSystemFiles) {
    console.log(`  Fetching ${gst.path}...`);
    const raw = repo.startsWith("/") ? readFileSync(join(repo, gst.path), "utf-8") : await fetchBlob(repo, gst.sha);
    const parsed = parseNode(raw);
    const gs = parsed.gameSystem;
    if (!gs) continue;
    gameSystemNodes.push(gs);

    const directRules = ensureArray(gs.rules?.rule);
    const sharedRules = ensureArray(gs.sharedRules?.rule);
    let skipped = 0;
    for (const r of [...directRules, ...sharedRules]) {
      // Skip stub rules with no description text yet (seen in the actively-developing
      // wh40k-11e repo) — an empty definition would look broken to a user querying it.
      if (!r.description) {
        skipped++;
        continue;
      }
      allRules.push({ name: r["@_name"], description: r.description });
      if (r["@_id"]) {
        globalRuleIndex.set(r["@_id"], r);
        GAME_SYSTEM_RULE_IDS.add(r["@_id"]);
        GAME_SYSTEM_RULE_IDS.add(String(r["@_name"]).trim().toLowerCase());
      }
    }
    console.log(
      `    → ${directRules.length + sharedRules.length - skipped} rules from ${gs["@_name"]}` +
        (skipped > 0 ? ` (${skipped} skipped: no description yet)` : ""),
    );

    // Index shared entries from game system file too
    indexSharedEntries(gs, globalSharedIndex);

    for (const [id, profile] of buildProfileIndex(gs)) {
      globalProfileIndex.set(id, profile);
    }

    if (extractCrusade) {
      const genericHonours = parseGenericCrusadeHonours(gs);
      allCrusadeHonours.push(...genericHonours);
      console.log(`    → ${genericHonours.length} generic/campaign Crusade Honours`);
    }
  }

  // ── Phase 1: Fetch and parse ALL catalogues (including libraries) ──
  const catalogues: ParsedCatalogue[] = [];

  for (const cat of catFiles) {
    console.log(`  Fetching ${cat.path}...`);
    const raw = repo.startsWith("/") ? readFileSync(join(repo, cat.path), "utf-8") : await fetchBlob(repo, cat.sha);
    const parsed = parseNode(raw);
    const catNode = parsed.catalogue;

    const isLibrary = catNode["@_library"] === "true" || cat.path.includes("Library");

    catalogues.push({
      id: catNode["@_id"],
      name: catNode["@_name"],
      isLibrary,
      raw: catNode,
    });

    // Index all shared entries from every catalogue into the global map
    indexSharedEntries(catNode, globalSharedIndex);

    if (isLibrary) {
      console.log(`    → Library catalogue (${globalSharedIndex.size} global entries so far)`);
    }
  }

  console.log(`\n  Global shared entry index: ${globalSharedIndex.size} entries`);

  // Extend the global rule index (seeded from the game system file above) with
  // each catalogue's own rules/sharedRules — e.g. faction-specific abilities
  // like Oath of Moment or Dark Pacts referenced via infoLink from a unit
  // entry in that same catalogue.
  for (const cat of catalogues) {
    const catRules = buildRuleIndex(cat.raw);
    for (const [id, rule] of catRules) {
      if (!globalRuleIndex.has(id)) {
        globalRuleIndex.set(id, rule);
      }
    }
    const catProfiles = buildProfileIndex(cat.raw);
    for (const [id, profile] of catProfiles) {
      if (!globalProfileIndex.has(id)) {
        globalProfileIndex.set(id, profile);
      }
    }
  }
  console.log(`  Global rule index: ${globalRuleIndex.size} rules`);
  const dynamicCategoryIds = collectDynamicCategoryIds([...gameSystemNodes, ...catalogues.map((c) => c.raw)]);
  console.log(`  Global profile index: ${globalProfileIndex.size} profiles`);

  // Roster-building categories that aren't datasheet keywords (see
  // listBuildingCategoryNames), and each catalogue's own faction keyword for
  // datasheets the data gives none (see homeFactionKeywords).
  const allNodes = [...gameSystemNodes, ...catalogues.map((c) => c.raw)];
  const tagCategories = listBuildingCategoryNames(allNodes);
  console.log(`  List-building categories left out of keywords: ${[...tagCategories].sort().join(", ")}`);
  const factionKeywords = new Set(
    allNodes.flatMap((n) => categoryEntries(n).map((ce) => ce.name).filter((name) => name.startsWith("Faction:")).map((name) => name.replace(/^Faction:\s*/, ""))),
  );
  const home = homeFactionKeywords(catalogues);
  for (const keyword of home.values()) factionKeywords.add(keyword);
  let factionKeywordsAdded = 0;
  /** A parsed datasheet's keywords: list-building tags dropped, and the home catalogue's faction keyword added when it has none. */
  const finishUnit = (unit: Unit, sourceEntryId: string | undefined): Unit => {
    const keywords = unit.keywords.filter((k) => !tagCategories.has(k));
    const homeFaction = sourceEntryId ? home.get(sourceEntryId) : undefined;
    if (homeFaction && !keywords.some((k) => factionKeywords.has(k))) {
      keywords.push(homeFaction);
      factionKeywordsAdded++;
    }
    return { ...unit, keywords };
  };

  // Build a lookup from catalogue ID → ParsedCatalogue for catalogueLink resolution
  const catalogueById = new Map<string, ParsedCatalogue>();
  for (const cat of catalogues) {
    catalogueById.set(cat.id, cat);
  }

  // Every detachment's name by id, across all catalogues and libraries, so an
  // enhancement's "hidden unless <detachment>" condition names its detachment.
  const detachmentNames = new Map<string, string>();
  for (const cat of catalogues) {
    for (const det of parseDetachments(cat.raw, "", globalSharedIndex, globalRuleIndex)) {
      if (!detachmentNames.has(det.id)) detachmentNames.set(det.id, det.name);
    }
  }

  // ── Phase 2: For each non-library catalogue, resolve units, detachments, enhancements ──
  const allUnits: Unit[] = [];
  const allDetachments: Detachment[] = [];
  const allEnhancements: Enhancement[] = [];

  for (const cat of catalogues) {
    if (cat.isLibrary) {
      console.log(`  Skipping library (units): ${cat.name}`);
      continue;
    }

    const faction = extractFaction(cat.name);
    const catUnits: Unit[] = [];

    // 2-pre: Extract detachments and enhancements from this catalogue
    const catDetachments = parseDetachments(cat.raw, faction, globalSharedIndex, globalRuleIndex);
    allDetachments.push(...catDetachments);

    if (extractCrusade) {
      allCrusadeHonours.push(...parseFactionCrusadeHonours(cat.raw, faction));
    }

    // Also check linked library catalogues for detachments —
    // but only the catalogue's OWN dedicated library (see libraryBelongsToFaction),
    // not every ally-unit library it links to for roster-building purposes.
    const catLinks = ensureArray(cat.raw.catalogueLinks?.catalogueLink);
    const factionDetachmentIds = new Set(catDetachments.map((d) => d.id));
    for (const catLink of catLinks) {
      const targetCatId = catLink["@_targetId"];
      if (!targetCatId) continue;
      const linkedCat = catalogueById.get(targetCatId);
      if (!linkedCat) continue;
      if (!libraryBelongsToFaction(cat.name, linkedCat.name)) continue;

      const linkedDetachments = parseDetachments(linkedCat.raw, faction, globalSharedIndex, globalRuleIndex);
      allDetachments.push(...linkedDetachments);
      for (const d of linkedDetachments) factionDetachmentIds.add(d.id);

      if (extractCrusade) {
        allCrusadeHonours.push(...parseFactionCrusadeHonours(linkedCat.raw, faction));
      }
    }

    // Enhancements: one whose detachment the data names belongs to this
    // faction exactly when the faction has that detachment, from whichever
    // catalogue it links (Genestealer Cults' live in "Library - Tyranids",
    // which isn't GSC's own library, so they were filed under Tyranids). One
    // without a known detachment comes from this catalogue or its own library,
    // as before.
    const catEnhancements: ParsedEnhancement[] = [];
    for (const source of [cat, ...catLinks.map((l: any) => catalogueById.get(l["@_targetId"]))]) {
      if (!source) continue;
      const own = source === cat || libraryBelongsToFaction(cat.name, source.name);
      for (const enh of collectEnhancements(source.raw, faction, detachmentNames)) {
        if (enh.detachmentId ? factionDetachmentIds.has(enh.detachmentId) : own) catEnhancements.push(enh);
      }
    }
    allEnhancements.push(...catEnhancements.map(({ detachmentId: _id, ...e }) => e));

    if (catDetachments.length > 0 || catEnhancements.length > 0) {
      console.log(`    → ${catDetachments.length} detachments, ${catEnhancements.length} enhancements`);
    }

    // 2a: Direct inline units from this catalogue. Shared entries are reusable
    // definitions, not roster choices; step 2b includes only those with a
    // root-level entryLink. Orks has both an orphaned, sparse Runtherd model
    // and a separately root-linked, fully tagged Runtherd character.
    const directEntries = ensureArray(cat.raw.selectionEntries?.selectionEntry);
    const ownSharedEntries = ensureArray(cat.raw.sharedSelectionEntries?.selectionEntry);
    const topLevelCandidates = [...directEntries, ...ownSharedEntries];

    // A direct entry may still be a nested component of another entry. Keep
    // the existing nested-link check, including links inside shared entries,
    // so those components are not emitted as independent units.
    const nestedlyConsumedIds = collectNestedEntryLinkTargets(topLevelCandidates);
    const rootEntryLinkTargetIds = new Set(
      ensureArray(cat.raw.entryLinks?.entryLink)
        .map((link: any) => link["@_targetId"])
        .filter(Boolean),
    );

    for (const entry of directEntries) {
      const id = entry["@_id"];
      if (id && nestedlyConsumedIds.has(id) && !rootEntryLinkTargetIds.has(id)) continue;
      const unit = parseEntryWithLinks(entry, faction, cat.id, globalSharedIndex, globalRuleIndex, globalProfileIndex, dynamicCategoryIds);
      if (unit) catUnits.push(finishUnit(unit, id));
    }

    // 2b: Resolve top-level entryLinks → look up in global shared index.
    // Accepts both type="unit" and type="model" targets — see parseEntryWithLinks.
    // A shared datasheet linked once per allegiance (Library - Titans) is read
    // through the link matching this catalogue's (see allegianceLinks).
    const allegiance = catalogueAllegiance(cat.name);
    const linkHidden = (link: any) => isHiddenIn(link, { primaryCatalogueId: cat.id });
    const emittedTargets = new Set<string>();
    const topEntryLinks = ensureArray(cat.raw.entryLinks?.entryLink);
    for (const link of allegianceLinks(topEntryLinks, allegiance, linkHidden, emittedTargets, cat.name)) {
      const targetId = link["@_targetId"];
      if (!targetId) continue;

      const target = globalSharedIndex.get(targetId);
      if (!target) continue;

      const unit = parseEntryWithLinks(withLinkCategories(target, link), faction, cat.id, globalSharedIndex, globalRuleIndex, globalProfileIndex, dynamicCategoryIds);
      if (unit) {
        // Use the link's id to avoid collisions with other factions using same shared entry
        const linkId = link["@_id"] || unit.id;
        catUnits.push({ ...finishUnit(unit, targetId), id: linkId });
        emittedTargets.add(targetId);
      }
    }

    // 2c: Resolve catalogueLinks — import units from linked catalogues
    // (catLinks already declared above for detachment/enhancement resolution)
    for (const catLink of catLinks) {
      const targetCatId = catLink["@_targetId"];
      if (!targetCatId) continue;

      const linkedCat = catalogueById.get(targetCatId);
      if (!linkedCat) continue;

      // Import the linked catalogue's own direct selectionEntries
      const linkedDirect = ensureArray(linkedCat.raw.selectionEntries?.selectionEntry);
      for (const entry of linkedDirect) {
        const unit = parseEntryWithLinks(entry, faction, cat.id, globalSharedIndex, globalRuleIndex, globalProfileIndex, dynamicCategoryIds);
        if (unit) catUnits.push(finishUnit(unit, entry["@_id"]));
      }

      // Resolve the linked catalogue's own root-level entryLinks — this is how a
      // library's named single-model characters (e.g. The Changeling, Skulltaker)
      // reach the output; see parseEntryWithLinks.
      const linkedEntryLinks = ensureArray(linkedCat.raw.entryLinks?.entryLink);
      for (const link of allegianceLinks(linkedEntryLinks, allegiance, linkHidden, emittedTargets, cat.name)) {
        const targetId = link["@_targetId"];
        if (!targetId) continue;

        const target = globalSharedIndex.get(targetId);
        if (!target) continue;

        const unit = parseEntryWithLinks(withLinkCategories(target, link), faction, cat.id, globalSharedIndex, globalRuleIndex, globalProfileIndex, dynamicCategoryIds);
        if (unit) {
          const linkId = link["@_id"] || unit.id;
          catUnits.push({ ...finishUnit(unit, targetId), id: linkId });
        }
      }
    }

    // Deduplicate within this faction by unit ID
    const dedupedUnits: Unit[] = [];
    const factionSeen = new Set<string>();
    for (const unit of catUnits) {
      if (!factionSeen.has(unit.id)) {
        factionSeen.add(unit.id);
        dedupedUnits.push(unit);
      }
    }

    // Reference tables from this catalogue and its own library (see referenceTables).
    const tables = [cat, ...catLinks.map((l: any) => catalogueById.get(l["@_targetId"]))]
      .filter((c): c is ParsedCatalogue => !!c && (c === cat || libraryBelongsToFaction(cat.name, c.name)))
      .flatMap((c) => referenceTables(c.raw, (id) => globalSharedIndex.get(id)));

    console.log(`  ${cat.name} → ${dedupedUnits.length} units`);
    allUnits.push(...attachReferenceTables(dedupedUnits, tables));
  }

  // Global dedup by ID (in case multiple factions share exact same ID — unlikely but safe).
  // Also stamp the gameSystem here: parseEntryNode/parseDetachments/parseEnhancements
  // hardcode "wh40k-10e", so the 11e caller's value is applied on the way out.
  const finalUnits: Unit[] = [];
  const globalSeen = new Set<string>();
  for (const unit of allUnits) {
    const key = `${unit.faction}::${unit.id}`;
    if (!globalSeen.has(key)) {
      globalSeen.add(key);
      finalUnits.push({ ...unit, gameSystem });
    }
  }

  // Global dedup detachments and enhancements by ID+faction
  const finalDetachments: Detachment[] = [];
  const detachmentSeen = new Set<string>();
  for (const det of allDetachments) {
    const key = `${det.faction}::${det.id}`;
    if (!detachmentSeen.has(key)) {
      detachmentSeen.add(key);
      finalDetachments.push({ ...det, gameSystem });
    }
  }

  const finalEnhancements: Enhancement[] = [];
  const enhancementSeen = new Set<string>();
  for (const enh of allEnhancements) {
    const key = `${enh.faction}::${enh.id}`;
    if (!enhancementSeen.has(key)) {
      enhancementSeen.add(key);
      finalEnhancements.push({ ...enh, gameSystem });
    }
  }

  const finalCrusadeHonours: CrusadeHonour[] = [];
  const crusadeHonourSeen = new Set<string>();
  for (const honour of allCrusadeHonours) {
    const key = `${honour.faction ?? ""}::${honour.campaign ?? ""}::${honour.id}`;
    if (!crusadeHonourSeen.has(key)) {
      crusadeHonourSeen.add(key);
      finalCrusadeHonours.push({ ...honour, gameSystem });
    }
  }

  console.log(`  Faction keyword added from the home catalogue to ${factionKeywordsAdded} datasheet copies with none`);
  console.log(`\n${gameSystem} Total: ${finalUnits.length} units, ${finalDetachments.length} detachments, ${finalEnhancements.length} enhancements, ${finalCrusadeHonours.length} Crusade Honours, ${allRules.length} shared rules`);

  // Log per-faction breakdown
  const factionCounts = new Map<string, number>();
  for (const unit of finalUnits) {
    factionCounts.set(unit.faction, (factionCounts.get(unit.faction) ?? 0) + 1);
  }
  const sortedFactions = [...factionCounts.entries()].sort((a, b) => b[1] - a[1]);
  console.log("\nPer-faction unit breakdown:");
  for (const [faction, count] of sortedFactions) {
    console.log(`  ${faction}: ${count}`);
  }

  // Log detachment/enhancement breakdown
  const detFactionCounts = new Map<string, number>();
  for (const det of finalDetachments) {
    detFactionCounts.set(det.faction, (detFactionCounts.get(det.faction) ?? 0) + 1);
  }
  const enhFactionCounts = new Map<string, number>();
  for (const enh of finalEnhancements) {
    enhFactionCounts.set(enh.faction, (enhFactionCounts.get(enh.faction) ?? 0) + 1);
  }
  console.log("\nPer-faction detachment/enhancement breakdown:");
  const allFactions = new Set([...detFactionCounts.keys(), ...enhFactionCounts.keys()]);
  for (const faction of [...allFactions].sort()) {
    const dets = detFactionCounts.get(faction) ?? 0;
    const enhs = enhFactionCounts.get(faction) ?? 0;
    console.log(`  ${faction}: ${dets} detachments, ${enhs} enhancements`);
  }

  if (extractCrusade) {
    console.log(`\nCrusade Honours: ${finalCrusadeHonours.length} total`);
  }

  return {
    units: finalUnits,
    detachments: finalDetachments,
    enhancements: finalEnhancements,
    crusadeHonours: finalCrusadeHonours,
    rules: allRules,
  };
}

export async function fetch40k() {
  console.log("Fetching file tree from BSData/wh40k-10e...");
  const tree = await fetchTree(REPO_40K);

  const gstFiles = tree.filter((e) => e.path.endsWith(".gst"));
  const catFiles = tree.filter((e) => e.path.endsWith(".cat"));
  console.log(`Found ${gstFiles.length} .gst file(s), ${catFiles.length} .cat file(s)`);

  return fetchCatalogueRepo(
    REPO_40K,
    gstFiles,
    catFiles,
    (xml) => xmlParser.parse(xml),
    "wh40k-10e",
  );
}

export async function fetch11e(localDir?: string) {
  // BSData/wh40k-11e went 404 in November 2026; a local clone of a fork works the same way.
  console.log(localDir ? `\nReading ${localDir}...` : "\nFetching file tree from BSData/wh40k-11e...");
  const tree: TreeEntry[] = localDir
    ? readdirSync(localDir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ path: f, sha: f }))
    : await fetchTree(REPO_40K_11E);
  const jsonFiles = tree.filter((e) => e.path.endsWith(".json"));

  const gameSystemFiles = jsonFiles.filter((e) => e.path === "Warhammer 40,000.json");
  const catFiles = jsonFiles.filter((e) => e.path !== "Warhammer 40,000.json");
  console.log(`Found ${catFiles.length} catalogue file(s), ${gameSystemFiles.length} game system file(s)`);

  return fetchCatalogueRepo(
    localDir ?? REPO_40K_11E,
    gameSystemFiles,
    catFiles,
    (raw) => normalizeJsonNode(JSON.parse(raw)),
    "wh40k-11e",
    true, // extractCrusade
  );
}

/** Index all shared selection entries from a catalogue/gameSystem node into the global map */
function indexSharedEntries(node: any, index: Map<string, any>): void {
  const sharedEntries = ensureArray(node.sharedSelectionEntries?.selectionEntry);
  for (const entry of sharedEntries) {
    if (entry["@_id"]) {
      index.set(entry["@_id"], entry);
    }
  }

  // Also index entries from sharedSelectionEntryGroups
  const sharedGroups = ensureArray(node.sharedSelectionEntryGroups?.selectionEntryGroup);
  for (const group of sharedGroups) {
    if (group["@_id"]) {
      index.set(group["@_id"], group);
    }
    const groupEntries = ensureArray(group.selectionEntries?.selectionEntry);
    for (const entry of groupEntries) {
      if (entry["@_id"]) {
        index.set(entry["@_id"], entry);
      }
    }
  }
}

/**
 * Collect every entryLink targetId referenced anywhere within a set of
 * entries' own descendant selectionEntries/selectionEntryGroups, at any
 * depth. Used by step 2a to tell apart a genuinely standalone top-level
 * entry from one that's actually a reusable component — e.g. a squad's
 * per-model wargear loadout variant — only ever reached via another
 * top-level entry's own nested wargear-option groups. Deliberately does
 * NOT include the catalogue's own root-level entryLinks (a different,
 * legitimate "roster access" mechanism, see step 2b) — those are read
 * separately by the caller.
 */
function collectNestedEntryLinkTargets(entries: any[]): Set<string> {
  const targets = new Set<string>();

  function collectLinks(node: any): void {
    for (const link of ensureArray(node.entryLinks?.entryLink)) {
      const targetId = link["@_targetId"];
      if (targetId) targets.add(targetId);
    }
  }

  function walk(entry: any): void {
    collectLinks(entry);

    for (const sub of ensureArray(entry.selectionEntries?.selectionEntry)) {
      walk(sub);
    }

    for (const group of ensureArray(entry.selectionEntryGroups?.selectionEntryGroup)) {
      collectLinks(group);
      for (const sub of ensureArray(group.selectionEntries?.selectionEntry)) {
        walk(sub);
      }
    }
  }

  entries.forEach(walk);
  return targets;
}

/**
 * Parse an entry node, resolving its internal entryLinks against the global
 * shared index. Accepts both type="unit" and type="model" — a standalone
 * named character with no wrapping "unit" container (e.g. Chaos Daemons'
 * The Changeling, Skulltaker, Skullmaster) is type="model" at the top
 * level, exactly like a squad's per-model wargear-loadout option is.
 * Previously this took a `unitOnly` flag that rejected every type="model"
 * entry reached via a root-level entryLink, added to keep wargear-loadout
 * components out — but that's the wrong signal to gate on: a root-level
 * entryLink (this catalogue's own, or a linked library's own — see 2b/2c
 * below) is BSData's actual "this is independently fieldable" mechanism,
 * and confirmed reliable by the phantom-unit investigation this replaced
 * (every real wargear-loadout component found was reached only via a
 * *nested* entryLink buried inside another unit's own option groups, never
 * a root-level one — see collectNestedEntryLinkTargets/2a above). Gating
 * on type="unit" here just meant every root-linked type="model" character
 * was silently dropped instead, which is what caused The Changeling (and
 * every other Chaos Daemons named character built this way) to be missing
 * entirely from both editions' bundled data.
 */
function parseEntryWithLinks(
  entry: any,
  faction: string,
  primaryCatalogueId: string,
  globalIndex: Map<string, any>,
  ruleIndex: Map<string, any>,
  profileIndex: Map<string, any>,
  dynamicCategoryIds: Set<string>,
): Unit | null {
  // A roster entry typed "upgrade" that carries its own Unit stat line is a
  // single-model datasheet BSData mistyped: Adeptus Mechanicus' root-linked
  // "X-101 [Legends]" (in 11e at f015101). Read it as the model it is.
  if (
    entry["@_type"] === "upgrade" &&
    ensureArray(entry.profiles?.profile).some((p: any) => p["@_typeId"] === UNIT_PROFILE_TYPE_ID)
  ) {
    entry = { ...entry, "@_type": "model" };
  }
  const type = entry["@_type"];
  // Also honours a datasheet hidden only in some catalogues, e.g. Space
  // Marines' Repulsor Executioner is "hidden if the primary catalogue is
  // Black Templars" (see isHiddenIn).
  if (isHiddenIn(entry, { primaryCatalogueId })) return null;
  if (type !== "unit" && type !== "model") return null;

  // Collect all profiles including from entryLinks (resolved against global index)
  const linked = new Set<any>();
  let profiles = collectAllProfilesWithGlobalLinks(entry, globalIndex, ruleIndex, profileIndex, new Set(), {
    primaryCatalogueId,
    ancestors: [],
    dynamicCategoryIds,
  }, false, [], linked);
  profiles = preferOwnWeaponProfiles(profiles, linked);

  // Fallback for datasheets whose Unit stat line is only an <infoLink
  // type="profile"> to a shared Unit profile, never inline (~248 in 11e; some
  // in 10e) — otherwise they surface with an empty stat table. No-op when a
  // stat line was already collected inline.
  profiles = withLinkedUnitProfile(entry, profiles, profileIndex, (id) => globalIndex.get(id));

  return parseEntryNode(entry, faction, profiles, {
    resolveEntry: (id) => globalIndex.get(id),
    profileIndex,
    primaryCatalogueId,
    dynamicCategoryIds,
  });
}

const WEAPON_PROFILE_TYPE_IDS = new Set(["f77d-b953-8fa4-b762", "8a40-4aaa-c780-9046"]); // Ranged, Melee Weapons

/**
 * Drops a weapon profile reached through an <infoLink type="profile"> (see
 * weaponProfileLinks) when the datasheet also has a profile of that name and
 * type of its own (written out, not linked). CSM's Crucible champions have
 * their own Combi-bolter (BS2+ S4 AP0) and also reach the shared Heretic
 * Astartes one (S5 AP-1) through the Combat Bike specialism; both were listed.
 * Identical rows are left to the later dedupe.
 */
export function preferOwnWeaponProfiles(profiles: any[], linked: Set<any>): any[] {
  const key = (p: any) => `${p["@_typeId"]}::${String(p["@_name"] ?? "").trim()}`;
  const own = new Set(profiles.filter((p) => WEAPON_PROFILE_TYPE_IDS.has(p["@_typeId"]) && !linked.has(p)).map(key));
  return profiles.filter((p) => !linked.has(p) || !own.has(key(p)));
}

/**
 * A root-level entryLink is the roster selection, so its own categoryLinks are
 * the unit's keywords too. BSData's Titans live once in "Library - Titans"
 * with no faction keyword at all; each Titanicus catalogue's link adds its own
 * ("Faction: Adeptus Titanicus" + IMPERIUM, "Faction: Titanicus Traitoris" +
 * CHAOS). Returns the target unchanged when the link adds nothing.
 */
export function withLinkCategories(target: any, link: any): any {
  const extra = ensureArray(link?.categoryLinks?.categoryLink);
  if (extra.length === 0) return target;
  const own = ensureArray(target.categoryLinks?.categoryLink);
  const have = new Set(own.map((cl: any) => cl["@_targetId"] ?? cl["@_name"]));
  const added = extra.filter((cl: any) => !have.has(cl["@_targetId"] ?? cl["@_name"]));
  if (added.length === 0) return target;
  return { ...target, categoryLinks: { ...target.categoryLinks, categoryLink: [...own, ...added] } };
}

const ALLEGIANCE_KEYWORDS = ["Imperium", "Chaos"] as const;
type Allegiance = (typeof ALLEGIANCE_KEYWORDS)[number];

/** "Chaos - Emperor's Children" → "Chaos"; catalogues not named for an allegiance (Orks, libraries) have none. */
export function catalogueAllegiance(catalogueName: string): Allegiance | undefined {
  return ALLEGIANCE_KEYWORDS.find((a) => catalogueName.startsWith(`${a} - `));
}

function linkAllegiance(link: any): Allegiance | undefined {
  const names = ensureArray(link?.categoryLinks?.categoryLink).map((cl: any) => cl["@_name"]);
  return ALLEGIANCE_KEYWORDS.find((a) => names.includes(a));
}

/**
 * The root entryLinks a catalogue reads, with each copy's allegiance matching
 * the catalogue's. "Library - Titans" links every Titan twice, once per side
 * (IMPERIUM + "Faction: Adeptus Titanicus", CHAOS + "Faction: Titanicus
 * Traitoris"), each hidden by a list of catalogues; Emperor's Children is
 * missing from the Chaos list (at f015101), so it saw only the Imperial copy.
 * A visible link whose allegiance contradicts the catalogue's is replaced by
 * its same-target sibling of the right allegiance (even one hidden here),
 * unless the catalogue already has that datasheet (`emitted`, its own root
 * links: Titanicus Traitoris). With no such sibling the link's own categories
 * are dropped, so the copy carries no contradicting keywords. Logged.
 */
export function allegianceLinks(
  links: any[],
  allegiance: Allegiance | undefined,
  hidden: (link: any) => boolean,
  emitted: Set<string> = new Set(),
  catalogueName = "",
): any[] {
  const out: any[] = [];
  for (const link of links) {
    if (hidden(link)) continue;
    const side = linkAllegiance(link);
    if (!allegiance || !side || side === allegiance) {
      out.push(link);
      continue;
    }
    const targetId = link["@_targetId"];
    const sibling = links.find((l) => l !== link && l["@_targetId"] === targetId && linkAllegiance(l) === allegiance);
    if ((sibling && !hidden(sibling)) || emitted.has(targetId)) continue; // read on its own / already there
    if (sibling) {
      console.log(`  ${catalogueName}: ${link["@_name"]} read through its ${allegiance} link (the ${side} one is the visible one)`);
      out.push(sibling);
    } else {
      console.log(`  ${catalogueName}: ${link["@_name"]}'s ${side} link categories dropped (no ${allegiance} link)`);
      const { categoryLinks: _drop, ...rest } = link;
      out.push(rest);
    }
  }
  return out;
}

/** A node's categoryEntries as plain records (10e XML and 11e JSON shapes). */
function categoryEntries(node: any): { id: string; name: string; hidden: boolean; unhidden: boolean }[] {
  const raw = node?.categoryEntries;
  return ensureArray(raw?.categoryEntry ?? raw).map((ce: any) => ({
    id: String(ce["@_id"] ?? ce.id ?? ""),
    name: String(ce["@_name"] ?? ce.name ?? ""),
    hidden: String(ce["@_hidden"] ?? ce.hidden) === "true",
    // A modifier that shows it (Ynnari, when the army is Ynnari).
    unhidden: ensureArray(ce.modifiers?.modifier).some(
      (m: any) => m["@_field"] === "hidden" && String(m["@_value"]) === "false",
    ),
  }));
}

/** Every rules text in a node: descriptions and characteristic values. */
function rulesTexts(node: any, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) rulesTexts(n, out);
  } else if (node !== null && typeof node === "object") {
    for (const [key, val] of Object.entries(node)) {
      if ((key === "description" || key === "#text") && typeof val === "string") out.push(val);
      else if (typeof val === "object") rulesTexts(val, out);
    }
  }
  return out;
}

/**
 * Category names that are list-building tags, not datasheet keywords:
 * - allied-units headings: "Allies: Adeptus Titanicus", "Harlequin Allies";
 * - hidden categories (BattleScribe never shows them) that no rules text
 *   names: points-cap and roster helpers like "Non-Kroot", "Khorne
 *   non-Battleline", "Non-Monster Character", "Voidfarer Character";
 * - "Titanic Support", the Titans' one-per-army allied slot, which is neither
 *   (shown, but no rule names it).
 * A hidden category a rule names stays a keyword: CRUCIBLE, HERETIC ASTARTES
 * VEHICLE, LEADER. A name is dropped only when every category of that name is a tag.
 */
export function listBuildingCategoryNames(nodes: any[]): Set<string> {
  const corpus = nodes.flatMap((n) => rulesTexts(n)).join("\n");
  const named = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(corpus);
  const verdict = new Map<string, boolean>();
  for (const ce of nodes.flatMap(categoryEntries)) {
    if (!ce.name || ce.name.startsWith("Faction:")) continue;
    const tag =
      /\bAllies\b/.test(ce.name) || ce.name === "Titanic Support" || (ce.hidden && !ce.unhidden && !named(ce.name));
    verdict.set(ce.name, (verdict.get(ce.name) ?? true) && tag);
  }
  return new Set([...verdict].filter(([, tag]) => tag).map(([name]) => name));
}

/**
 * Datasheet id → the faction keyword of the catalogue that defines it, for
 * datasheets the data gives no faction keyword (AdMech's X-101 [Legends] and
 * Terrax-Pattern Termite, Space Marines' Drop Pod): the "Faction: X" category
 * on nearly all (90%+) of that catalogue's own datasheets. Catalogues and
 * libraries holding several factions' datasheets (Library - Astartes Heresy
 * Legends) name none.
 */
export function homeFactionKeywords(catalogues: { raw: any }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const cat of catalogues) {
    const entries = [
      ...ensureArray(cat.raw.sharedSelectionEntries?.selectionEntry),
      ...ensureArray(cat.raw.selectionEntries?.selectionEntry),
    ].filter((e: any) => e["@_type"] === "unit" || e["@_type"] === "model");
    const counts = new Map<string, number>();
    let tagged = 0;
    for (const e of entries) {
      const factions = new Set(
        ensureArray(e.categoryLinks?.categoryLink)
          .map((cl: any) => String(cl["@_name"] ?? ""))
          .filter((n) => n.startsWith("Faction:")),
      );
      if (factions.size > 0) tagged++;
      for (const f of factions) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!top || n! < 0.9 * tagged) continue;
    const keyword = top.replace(/^Faction:\s*/, "");
    for (const e of [
      ...ensureArray(cat.raw.sharedSelectionEntries?.selectionEntry),
      ...ensureArray(cat.raw.selectionEntries?.selectionEntry),
    ]) {
      if (e["@_id"] && !out.has(e["@_id"])) out.set(e["@_id"], keyword);
    }
  }
  return out;
}

/**
 * Appends each reference table (see referenceTables) to the army rule that
 * uses it: the ability named like the table ("Blessings of Khorne", "Martial
 * Ka'tah"), or, when no ability has that name, the one that mentions it on the
 * most of the faction's datasheets (Thousand Sons' "Cabal of Sorcerers" for
 * "Rituals"). Units are returned as new objects; abilities are not shared.
 */
export function attachReferenceTables(units: Unit[], tables: { name: string; text: string }[]): Unit[] {
  if (tables.length === 0) return units;
  const lower = (s: string) => s.toLowerCase().trim();
  const targets = new Map<string, string>(); // ability name → table text
  for (const table of tables) {
    const exact = units.some((u) => u.abilities.some((a) => lower(a.name) === lower(table.name)));
    let target = exact ? table.name : undefined;
    if (!target) {
      const mention = new RegExp(`\\b${table.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const counts = new Map<string, number>();
      for (const u of units) for (const a of u.abilities) if (mention.test(a.description)) counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
      target = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    }
    if (target) targets.set(lower(target), `**${table.name}**\n\n${table.text}`);
  }
  return units.map((u) => {
    if (!u.abilities.some((a) => targets.has(lower(a.name)))) return u;
    return {
      ...u,
      abilities: u.abilities.map((a) => {
        const text = targets.get(lower(a.name));
        return text && !a.description.includes(text) ? { ...a, description: `${a.description}\n\n${text}` } : a;
      }),
    };
  });
}

/**
 * entryLinks whose name matches one of these patterns point to a broad
 * shared option pool (an entire faction's Enhancements catalogue, every
 * Warlord Trait in the book, every Crusade Relic, every universal weapon-
 * customization option in the game) rather than content specific to the
 * unit that references it. Following these causes massive unrelated bloat
 * — confirmed: one unit's "abilities" count ballooned from ~5 to ~397 by
 * pulling in an entire shared Enhancements catalogue this way, because
 * that link ("Dark Age Arsenal Enhancements") sat alongside the unit's own
 * real content rather than being a node's sole content, so a purely
 * structural "is this the only thing here" check doesn't reliably catch
 * it either (a wanted reference, e.g. Astra Militarum's "Shock Trooper
 * Sergeant", can legitimately sit alongside other real content too).
 * These specific categories are already tracked as their own first-class
 * data elsewhere in this project (Enhancements has its own parseEnhancements
 * pipeline) or are out of scope (Crusade narrative rules, Warlord Trait
 * eligibility) — this project doesn't need their content mixed into unit
 * weapon/ability profiles.
 *
 * "boon" covers each Chaos legion's "Boons of <God>" / "Chaos Boons" group
 * (confirmed via BSData/wh40k-11e: every such link resolves to a target
 * whose own `comment` is "Crusade content") — without it, units like Chosen
 * and Cultist Mob picked up mutation-flavoured abilities (Mutant Form,
 * Massive Fangs, Scorpion Tail, Daemonic Flesh, Warp Stalker, Dark Blessing)
 * that only apply after a Crusade boon roll, not on the base datasheet.
 *
 * Deliberately does NOT exclude Crucible/made-to-order characters' own
 * "Weapons"/"Abilities"/"Specialisms"/"Chapter" entryLinks (tried, reverted —
 * see docs/design/11e-support.md's 2026-08-01 follow-up). These looked like
 * the same kind of bloat at first glance (one unit's ability count went from
 * ~6 to 40, weapons to 29+20), but user-provided official rules pages for
 * "Crucible Champions — Adeptus Astartes" confirmed this is GW's actual,
 * intentional design: a Crucible character is built by picking up to one
 * Specialism, exactly one Ability, and its Weapons (up to 1 ranged + 2
 * pistols + 1-2 melee) from real menus — structurally identical to how an
 * ordinary squad's wargear options are already listed in full here (e.g.
 * Intercessor Squad's 7 ranged options), just a bigger menu. Excluding them
 * was net-negative (a Crucible character showing 0 weapons is less accurate
 * than showing every real weapon option), not a fix.
 */
const UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN =
  /enhancement|warlord|crusade|weapon modifications?|battle trait|battle scar|requisition|boons?/i;

/** Hard ceiling on profiles collected for one unit — a circuit breaker against
 * any *other* unanticipated broad-shared-pool link category slipping through
 * the denylist above and silently blowing up the output (as happened once
 * already). A real datasheet never legitimately has this many profiles. */
const MAX_PROFILES_PER_UNIT = 100;

/**
 * Like collectAllProfiles but also resolves entryLinks (references to
 * shared content elsewhere by id) against a global cross-catalogue index,
 * skipping links that match UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN. Also
 * resolves each level's rule-type infoLinks against `ruleIndex` (see
 * ruleLinksToAbilityProfiles) — this is how named core/faction abilities
 * like Deep Strike, Infiltrators, or Dark Pacts actually reach a unit's
 * abilities list, since BSData references the shared rule text instead of
 * duplicating it as an inline profile on every datasheet that has it.
 * `visited` guards against a cyclical entryLink chain turning into infinite
 * recursion (not expected in real BSData, but this walks external
 * references from a separately-fetched index rather than a pure inline
 * tree, so it's cheap insurance).
 */
function collectAllProfilesWithGlobalLinks(
  entry: any,
  globalIndex: Map<string, any>,
  ruleIndex: Map<string, any>,
  profileIndex: Map<string, any>,
  visited: Set<string> = new Set(),
  env: VisibilityEnv = {},
  isGroup = false,
  selfIds: string[] = [],
  // Weapon profiles reached through a profile infoLink: see preferOwnWeaponProfiles.
  linked: Set<any> = new Set(),
): any[] {
  // `env.ancestors` are the selections enclosing `entry`; its own content is
  // read in that context, and its children with `entry` itself added (a
  // group isn't a selection, so its children share its context).
  const profileLinks = weaponProfileLinks(entry, profileIndex, env);
  for (const p of profileLinks) linked.add(p);
  const direct = [
    ...ensureArray(entry.profiles?.profile),
    ...infoGroupContents(entry, env).profiles,
    ...profileLinks,
  ].filter((p: any) => !isHiddenIn(p, env, true));
  noteWeaponRules(entry, direct, ruleIndex, env, GAME_SYSTEM_RULE_IDS);
  const ruleAbilities = ruleLinksToAbilityProfiles(entry, ruleIndex, profileIndex, env);
  const inner: VisibilityEnv = isGroup
    ? env
    : {
        ...env,
        ancestors: [
          ...(env.ancestors ?? []),
          new Set(
            [
              entry["@_id"],
              ...selfIds,
              ...ensureArray(entry.categoryLinks?.categoryLink).map((cl: any) => cl["@_targetId"]),
            ].filter(Boolean),
          ),
        ],
      };

  const entryLinks = ensureArray(entry.entryLinks?.entryLink);
  const linkedProfiles = entryLinks.flatMap((link: any) => {
    const targetId = link["@_targetId"];
    const linkName = link["@_name"] ?? "";
    if (!targetId || visited.has(targetId)) return [];
    if (UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN.test(linkName)) return [];
    const target = globalIndex.get(targetId);
    if (!target) return [];
    if (isLinkHiddenIn(link, target, inner)) return [];
    visited.add(targetId);
    return collectAllProfilesWithGlobalLinks(
      target,
      globalIndex,
      ruleIndex,
      profileIndex,
      visited,
      inner,
      link["@_type"] === "selectionEntryGroup",
      [link["@_id"], targetId],
      linked,
    );
  });

  const subEntries = ensureArray(entry.selectionEntries?.selectionEntry).filter((sub: any) => !isHiddenIn(sub, inner));
  const subEntryProfiles = subEntries.flatMap((sub: any) =>
    collectAllProfilesWithGlobalLinks(sub, globalIndex, ruleIndex, profileIndex, visited, inner, false, [], linked),
  );

  const groups = ensureArray(entry.selectionEntryGroups?.selectionEntryGroup).filter(
    (group: any) => !isHiddenIn(group, inner),
  );
  const groupProfiles = groups.flatMap((group: any) => {
    // A group's own name can be the universal-pool signal even when the
    // entryLink nested inside it isn't (see UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN):
    // BattleScribe's standard "Crusade" wrapper group holds a single entryLink to
    // "Mighty Champions" — a shared pool of generic Crusade-only narrative
    // abilities used by nearly every named character across every faction, not
    // specific to the unit that references it (confirmed: Chaos Daemons' The
    // Changeling's abilities ballooned with duplicated "Front-line/Inspirational/
    // Logistical/Nemesis/Restorative/Strategic/Subtle Champions" text this way —
    // the link itself is named "Mighty Champions", which doesn't match the
    // pattern; only the enclosing group's name, "Crusade", does).
    if (UNIVERSAL_OPTION_POOL_LINK_NAME_PATTERN.test(group["@_name"] ?? "")) return [];
    return collectAllProfilesWithGlobalLinks(group, globalIndex, ruleIndex, profileIndex, visited, inner, true, [], linked);
  });

  const all = [...direct, ...ruleAbilities, ...linkedProfiles, ...subEntryProfiles, ...groupProfiles];
  if (all.length > MAX_PROFILES_PER_UNIT) {
    console.warn(
      `  ⚠ ${entry["@_name"] ?? "?"}: ${all.length} profiles collected, exceeds ${MAX_PROFILES_PER_UNIT} — likely an unanticipated shared-pool link category; truncating`,
    );
    return all.slice(0, MAX_PROFILES_PER_UNIT);
  }
  return all;
}

// ── Fetch Kill Team data ────────────────────────────────────────────────

async function fetchKillTeam(): Promise<{
  operatives: KillTeamOperative[];
  rules: { name: string; description: string }[];
}> {
  console.log("\nFetching file tree from BSData/wh40k-killteam...");
  const tree = await fetchTree(REPO_KT, "master");

  // Only 2024 edition files
  const gstFiles = tree.filter(
    (e) => e.path.endsWith(".gst") && e.path.startsWith("2024 - ")
  );
  const catFiles = tree.filter(
    (e) => e.path.endsWith(".cat") && e.path.startsWith("2024 - ")
  );

  console.log(
    `Found ${gstFiles.length} .gst file(s), ${catFiles.length} .cat file(s) (2024 edition)`
  );

  const allRules: { name: string; description: string }[] = [];

  for (const gst of gstFiles) {
    console.log(`  Fetching ${gst.path}...`);
    const xml = await fetchBlob(REPO_KT, gst.sha);
    const result = parseKillTeamGameSystem(xml);
    console.log(`    → ${result.rules.length} rules from ${result.name}`);
    for (const r of result.rules) {
      allRules.push({ name: r.name, description: r.description });
    }
  }

  const allOperatives: KillTeamOperative[] = [];

  for (const cat of catFiles) {
    if (cat.path.includes("Library")) {
      console.log(`  Skipping library: ${cat.path}`);
      continue;
    }

    console.log(`  Fetching ${cat.path}...`);
    const xml = await fetchBlob(REPO_KT, cat.sha);
    const operatives = parseKillTeamCatalogue(xml);
    console.log(`    → ${operatives.length} operatives`);
    allOperatives.push(...operatives);
  }

  console.log(
    `\nKill Team Total: ${allOperatives.length} operatives, ${allRules.length} shared rules`
  );
  return { operatives: allOperatives, rules: allRules };
}

// ── Fetch Horus Heresy 3rd Edition data ─────────────────────────────────
// BSData/horus-heresy-3rd-edition ships JSON only: one game system file plus
// ~42 catalogues (Legions, the shared "Legiones Astartes" unit library, the
// Weapons/Wargear/Special Rules libraries, other factions). All parsing,
// including unit attribution and de-duplication of the Legiones Astartes
// library, lives in src/lib/heresy-parser.ts; this only gathers the files.

export async function fetchHeresy(localDir?: string): Promise<HeresyParseResult> {
  const files: HeresySourceFile[] = [];
  if (localDir) {
    console.log(`\nReading Horus Heresy 3rd Edition data from ${localDir}...`);
    for (const name of readdirSync(localDir).filter((f) => f.endsWith(".json")).sort()) {
      // Data only: each file is parsed as JSON, nothing in the clone is executed.
      files.push({ path: name, data: JSON.parse(readFileSync(join(localDir, name), "utf-8")) });
    }
  } else {
    console.log(`\nFetching file tree from ${REPO_HERESY}...`);
    const tree = await fetchTree(REPO_HERESY);
    // Top-level catalogue/game-system JSON only (skip raw/ metadata).
    const jsonFiles = tree.filter((e) => e.path.endsWith(".json") && !e.path.includes("/"));
    for (const entry of jsonFiles) {
      console.log(`  Fetching ${entry.path}...`);
      files.push({ path: entry.path, data: JSON.parse(await fetchBlob(REPO_HERESY, entry.sha)) });
    }
  }
  const result = parseHeresyData(files);
  const perFaction = new Map<string, number>();
  for (const u of result.units) perFaction.set(u.faction, (perFaction.get(u.faction) ?? 0) + 1);
  console.log(
    `\nhorus-heresy-3e Total: ${result.units.length} units, ${result.weapons.length} weapons, ${result.rules.length} special rules, ${result.factions.length} factions`,
  );
  for (const [faction, count] of [...perFaction.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${faction}: ${count}`);
  }
  return result;
}

function writeHeresyData(result: HeresyParseResult): void {
  const header = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_HERESY}`,
    "",
  ];
  const unitsPath = join(ROOT, "src", "data", "heresy-units.ts");
  writeFileSync(
    unitsPath,
    [
      ...header,
      'import type { HeresyUnit, HeresyFaction } from "../types.js";',
      "",
      `export const HERESY_UNITS: HeresyUnit[] = ${JSON.stringify(result.units, null, 2)};`,
      "",
      `export const HERESY_FACTIONS: HeresyFaction[] = ${JSON.stringify(result.factions, null, 2)};`,
      "",
    ].join("\n"),
    "utf-8",
  );
  console.log(`Wrote ${unitsPath} (${result.units.length} units, ${result.factions.length} factions)`);

  const weaponsPath = join(ROOT, "src", "data", "heresy-weapons.ts");
  writeFileSync(
    weaponsPath,
    [
      ...header,
      'import type { HeresyWeapon } from "../types.js";',
      "",
      `export const HERESY_WEAPONS: HeresyWeapon[] = ${JSON.stringify(result.weapons, null, 2)};`,
      "",
    ].join("\n"),
    "utf-8",
  );
  console.log(`Wrote ${weaponsPath} (${result.weapons.length} weapons)`);

  const rulesPath = join(ROOT, "src", "data", "heresy-rules.ts");
  writeFileSync(
    rulesPath,
    [
      ...header,
      'import type { HeresySpecialRule } from "../types.js";',
      "",
      `export const HERESY_SPECIAL_RULES: HeresySpecialRule[] = ${JSON.stringify(result.rules, null, 2)};`,
      "",
    ].join("\n"),
    "utf-8",
  );
  console.log(`Wrote ${rulesPath} (${result.rules.length} special rules)`);

  const profileRulesPath = join(ROOT, "src", "data", "heresy-profile-rules.ts");
  writeFileSync(
    profileRulesPath,
    [
      ...header,
      "// Reactions, Gambits, psychic powers, wargear, battlefield assets and detachments: rules the data stores as profiles.",
      'import type { HeresySpecialRule } from "../types.js";',
      "",
      `export const HERESY_PROFILE_RULES: HeresySpecialRule[] = ${JSON.stringify(result.profileRules, null, 2)};`,
      "",
    ].join("\n"),
    "utf-8",
  );
  console.log(`Wrote ${profileRulesPath} (${result.profileRules.length} profile-based rules)`);
}

/** Write every src/data/*-11e.ts file. `source` is printed in each file's header. */
function write11eData(
  data: { units11e: Unit[]; detachments11e: Detachment[]; enhancements11e: Enhancement[];
          crusadeHonours11e: CrusadeHonour[]; rules11e: { name: string; description: string }[] },
  source: string,
): void {
  const { units11e, detachments11e, enhancements11e, crusadeHonours11e, rules11e } = data;
  // ── Write src/data/units-11e.ts ──
  const units11ePath = join(ROOT, "src", "data", "units-11e.ts");
  const units11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: ${source}`,
    "",
    'import type { Unit } from "../types.js";',
    "",
    `export const UNITS_11E: Unit[] = ${JSON.stringify(units11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(units11ePath, units11eContent, "utf-8");
  console.log(`Wrote ${units11ePath} (${units11e.length} units)`);

  // ── Write src/data/detachments-11e.ts ──
  const detachments11ePath = join(ROOT, "src", "data", "detachments-11e.ts");
  const detachments11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: ${source}`,
    "",
    'import type { Detachment } from "../types.js";',
    "",
    `export const DETACHMENTS_11E: Detachment[] = ${JSON.stringify(detachments11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(detachments11ePath, detachments11eContent, "utf-8");
  console.log(`Wrote ${detachments11ePath} (${detachments11e.length} detachments)`);

  // ── Write src/data/enhancements-11e.ts ──
  const enhancements11ePath = join(ROOT, "src", "data", "enhancements-11e.ts");
  const enhancements11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: ${source}`,
    "",
    'import type { Enhancement } from "../types.js";',
    "",
    `export const ENHANCEMENTS_11E: Enhancement[] = ${JSON.stringify(enhancements11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(enhancements11ePath, enhancements11eContent, "utf-8");
  console.log(`Wrote ${enhancements11ePath} (${enhancements11e.length} enhancements)`);

  // ── Write src/data/crusade-11e.ts ──
  const crusade11ePath = join(ROOT, "src", "data", "crusade-11e.ts");
  const crusade11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: ${source}`,
    "",
    'import type { CrusadeHonour } from "../types.js";',
    "",
    `export const CRUSADE_HONOURS_11E: CrusadeHonour[] = ${JSON.stringify(crusadeHonours11e, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(crusade11ePath, crusade11eContent, "utf-8");
  console.log(`Wrote ${crusade11ePath} (${crusadeHonours11e.length} Crusade Honours)`);

  // ── Write src/data/rules-11e.ts ──
  const rules11ePath = join(ROOT, "src", "data", "rules-11e.ts");
  const rules11eContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: ${source}`,
    "",
    "export const SHARED_RULES_11E: { name: string; description: string }[] = " +
      JSON.stringify(rules11e, null, 2) +
      ";",
    "",
  ].join("\n");

  writeFileSync(rules11ePath, rules11eContent, "utf-8");
  console.log(`Wrote ${rules11ePath} (${rules11e.length} rules)`);

}

// ── Main ─────────────────────────────────────────────────────────────────

function cliOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  // --only=<system> regenerates a single system's data files (e.g. while
  // developing the Heresy parser) without re-fetching every repo. The daily
  // sync runs with no arguments and regenerates everything.
  const only = cliOption("only");
  if (only === "heresy") {
    writeHeresyData(await fetchHeresy(cliOption("heresy-dir")));
    return;
  }
  if (only === "40k11e") {
    // --dir=<local clone of a wh40k-11e fork> --source=<label for the file headers>
    const dir = cliOption("dir");
    const r = await fetch11e(dir);
    write11eData({ units11e: r.units, detachments11e: r.detachments, enhancements11e: r.enhancements,
                   crusadeHonours11e: r.crusadeHonours, rules11e: r.rules },
                 cliOption("source") ?? (dir ? dir : `https://github.com/${REPO_40K_11E}`));
    return;
  }
  if (only !== undefined && only !== "") {
    throw new Error(`--only=${only} is not supported; use --only=heresy, --only=40k11e or run without --only`);
  }

  const { units, detachments, enhancements, rules: rules40k } = await fetch40k();
  const {
    units: units11e,
    detachments: detachments11e,
    enhancements: enhancements11e,
    crusadeHonours: crusadeHonours11e,
    rules: rules11e,
  } = await fetch11e();
  const { operatives, rules: rulesKT } = await fetchKillTeam();
  const heresy = await fetchHeresy();

  // ── Write src/data/units.ts ──
  const unitsPath = join(ROOT, "src", "data", "units.ts");
  const unitsContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    'import type { Unit } from "../types.js";',
    "",
    `export const UNITS: Unit[] = ${JSON.stringify(units, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(unitsPath, unitsContent, "utf-8");
  console.log(`Wrote ${unitsPath} (${units.length} units)`);

  // ── Write src/data/detachments.ts ──
  const detachmentsPath = join(ROOT, "src", "data", "detachments.ts");
  const detachmentsContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    'import type { Detachment } from "../types.js";',
    "",
    `export const DETACHMENTS: Detachment[] = ${JSON.stringify(detachments, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(detachmentsPath, detachmentsContent, "utf-8");
  console.log(`Wrote ${detachmentsPath} (${detachments.length} detachments)`);

  // ── Write src/data/enhancements.ts ──
  const enhancementsPath = join(ROOT, "src", "data", "enhancements.ts");
  const enhancementsContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    'import type { Enhancement } from "../types.js";',
    "",
    `export const ENHANCEMENTS: Enhancement[] = ${JSON.stringify(enhancements, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(enhancementsPath, enhancementsContent, "utf-8");
  console.log(`Wrote ${enhancementsPath} (${enhancements.length} enhancements)`);

  // ── Write src/data/rules.ts ──
  const rulesPath = join(ROOT, "src", "data", "rules.ts");
  const rulesContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_40K}`,
    "",
    "export const SHARED_RULES: { name: string; description: string }[] = " +
      JSON.stringify(rules40k, null, 2) +
      ";",
    "",
  ].join("\n");

  writeFileSync(rulesPath, rulesContent, "utf-8");
  console.log(`Wrote ${rulesPath} (${rules40k.length} rules)`);

  write11eData({ units11e, detachments11e, enhancements11e, crusadeHonours11e, rules11e }, `https://github.com/${REPO_40K_11E}`);

  // ── Write src/data/kill-team-operatives.ts ──
  const ktPath = join(ROOT, "src", "data", "kill-team-operatives.ts");
  const ktContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_KT}`,
    "",
    'import type { KillTeamOperative } from "../types.js";',
    "",
    `export const KILL_TEAM_OPERATIVES: KillTeamOperative[] = ${JSON.stringify(operatives, null, 2)};`,
    "",
  ].join("\n");

  writeFileSync(ktPath, ktContent, "utf-8");
  console.log(`Wrote ${ktPath} (${operatives.length} operatives)`);

  // ── Write src/data/kill-team-rules.ts ──
  const ktRulesPath = join(ROOT, "src", "data", "kill-team-rules.ts");
  const ktRulesContent = [
    "// Auto-generated by scripts/fetch-data.ts — do not edit manually",
    `// Generated: ${new Date().toISOString()}`,
    `// Source: https://github.com/${REPO_KT}`,
    "",
    "export const KILL_TEAM_SHARED_RULES: { name: string; description: string }[] = " +
      JSON.stringify(rulesKT, null, 2) +
      ";",
    "",
  ].join("\n");

  writeFileSync(ktRulesPath, ktRulesContent, "utf-8");
  console.log(`Wrote ${ktRulesPath} (${rulesKT.length} rules)`);

  // ── Write src/data/heresy-*.ts ──
  writeHeresyData(heresy);
}

// Only auto-run when this file is the process entrypoint (`npx tsx scripts/fetch-data.ts`),
// so it can also be imported for testing individual fetch functions (e.g. fetch11e()).
const isMainModule = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (isMainModule) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
