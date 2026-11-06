// The price sync's comparison (pure): which hashes to write and which to remove, judged by the prices only.
// SAP re-stamps nearly every row's UpdateDate (`ud`) each day, so comparing timestamps would rewrite everything;
// comparing the ladders writes only what really changed (the source shop's importer rewrites all 36M prices every run).
import { parseLadder } from "@/features/company-pricing/ladder";
import type { LadderFields } from "@/features/company-pricing/types";

export type LadderDiff = { set: Record<string, LadderFields>; remove: string[]; added: number; changed: number; unchanged: number };

const content = (fields: LadderFields | null | undefined) => JSON.stringify(parseLadder(fields) ?? null);

export function diffLadders(next: Record<string, LadderFields>, current: Map<string, LadderFields | null>): LadderDiff {
  const diff: LadderDiff = { set: {}, remove: [], added: 0, changed: 0, unchanged: 0 };
  for (const [key, fields] of Object.entries(next)) {
    const before = current.get(key);
    if (!before) diff.added++;
    else if (content(before) !== content(fields)) diff.changed++;
    else {
      diff.unchanged++;
      continue;
    }
    diff.set[key] = fields;
  }
  for (const [key, fields] of current) if (fields && !(key in next)) diff.remove.push(key);
  return diff;
}
