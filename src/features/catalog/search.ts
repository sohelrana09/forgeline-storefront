// Ranking for the in-memory site search (pure functions; the index itself is built in service.ts).
// A query matches when every word matches some field. Per word the best match counts, strongest first:
// whole word, start of a word, inside a word, then a typo (1 edit, 2 for long words) only when the word matches
// nothing exactly anywhere. Model codes also match by their letters: "S567 UV" (SKU s567-uv) is found by "suv".
import type { TypedMoney } from "@commercetools/platform-sdk";

export type SearchEntry = {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  image?: string;
  price?: TypedMoney;
  // Set when variants are priced differently: the lowest, shown as "From …".
  fromPrice?: TypedMoney;
  // Folded words per field, weakest field last.
  nameWords: string[];
  codes: string[];
  categories: string[];
  attributes: string[];
  description: string[];
};

export const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
export const words = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// SKU forms people type: "s567-uv", "s567uv", "suv" (letters only, for model codes like S567 UV).
export function codeWords(sku: string): string[] {
  const s = fold(sku);
  const compact = s.replace(/[^a-z0-9]/g, "");
  const letters = s.replace(/[^a-z]/g, "");
  return [...new Set([...words(s), compact, ...(letters.length >= 2 && letters !== compact ? [letters] : [])])];
}

const FIELDS = [
  ["nameWords", 10],
  ["codes", 9],
  ["categories", 5],
  ["attributes", 4],
  ["description", 2],
] as const;

const editLimit = (w: string) => (w.length >= 8 ? 2 : w.length >= 4 ? 1 : 0);

// Damerau-Levenshtein distance, stopping early once it exceeds `max`.
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

// Score of one query word against one entry: 0 = no match.
function wordScore(entry: SearchEntry, w: string, fuzzy: boolean): number {
  let best = 0;
  for (const [field, weight] of FIELDS) {
    for (const t of entry[field]) {
      const s =
        t === w ? weight * 3 : t.startsWith(w) ? weight * 2 : w.length >= 3 && t.includes(w) ? weight : fuzzy && t.length >= 4 && distance(w, t, editLimit(w)) <= editLimit(w) ? weight / 2 : 0;
      if (s > best) best = s;
    }
  }
  return best;
}

// The words that match nothing as typed get a typo-tolerant second chance; `corrected` then names what was used.
export function rank(index: SearchEntry[], query: string): { matches: SearchEntry[]; corrected?: string } {
  const qs = words(query).slice(0, 10);
  if (qs.length === 0) return { matches: [] };
  const exact = (w: string) => index.some((e) => wordScore(e, w, false) > 0);
  const fuzzyWords = new Set(qs.filter((w) => editLimit(w) > 0 && !exact(w)));
  const scored = index
    .map((e) => {
      let total = 0;
      for (const w of qs) {
        const s = wordScore(e, w, fuzzyWords.has(w));
        if (s === 0) return undefined;
        total += s;
      }
      return { e, total };
    })
    .filter((x): x is { e: SearchEntry; total: number } => x !== undefined)
    .sort((a, b) => b.total - a.total || a.e.name.localeCompare(b.e.name));
  const matches = scored.map((x) => x.e);
  if (fuzzyWords.size === 0 || matches.length === 0) return { matches };
  // Name the corrected words after the closest word found in the best match.
  const top = matches[0];
  const corrected = qs
    .map((w) => {
      if (!fuzzyWords.has(w)) return w;
      const all = FIELDS.flatMap(([f]) => top[f]);
      return all.reduce((best, t) => (distance(w, t, 2) < distance(w, best, 2) ? t : best), all[0] ?? w);
    })
    .join(" ");
  return { matches, corrected };
}
