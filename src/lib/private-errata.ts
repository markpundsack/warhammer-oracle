/**
 * Corrections from GW's 11e faction packs that BSData hasn't caught up with, when the deployment supplies
 * them. GW's terms are personal use only, so the file is never committed (src/data/private/ is
 * gitignored): the deploy writes it (skully's deploy/oracle-private-errata.py) and the Docker image carries
 * it to /app/private.
 *
 * The file holds whole replacement records, by position in the arrays the tools serve, each checked by
 * name: { units: [{ i, name, record }], detachments: [...], enhancements: [...], stratagems: [...] }.
 * PACK_ERRATA_11E names the file, or "none" (tests, and exports that compute the file).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Patch = { i: number; name: string; record: Record<string, unknown> };
type ErrataFile = Partial<Record<"units" | "detachments" | "enhancements" | "stratagems", Patch[]>>;

function load(): ErrataFile {
  const here = dirname(fileURLToPath(import.meta.url));
  const env = process.env.PACK_ERRATA_11E;
  const file = env !== undefined ? (existsSync(env) ? env : undefined)
    : [join(here, "../../private/40k-pack-errata.json"), join(here, "../data/private/40k-pack-errata.json")]
        .find((p) => existsSync(p));
  if (!file) return {};
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as ErrataFile;
  } catch {
    return {};
  }
}

const ERRATA = load();

/** Replace, in place, the records the errata file corrects. A record whose name no longer matches is skipped. */
export function applyPackErrata<T extends { name: string }>(kind: keyof ErrataFile, records: T[]): T[] {
  for (const p of ERRATA[kind] ?? []) {
    if (records[p.i] && records[p.i].name === p.name) records[p.i] = p.record as unknown as T;
  }
  return records;
}
