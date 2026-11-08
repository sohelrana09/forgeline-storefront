// Product compare, spec sheets and downloads (docs/features/product-specs-downloads-compare.md), pure and
// unit-tested. The compare list is up to COMPARE_MAX SKUs in the URL (/compare?skus=a,b,c), so it can be shared; the
// browser remembers the visitor's own list (CompareButton).

export const COMPARE_MAX = 4;
const SKU = /^[A-Za-z0-9._-]{1,64}$/;

export function parseCompareSkus(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => SKU.test(s)),
    ),
  ].slice(0, COMPARE_MAX);
}

export const compareHref = (skus: string[]) => (skus.length ? `/compare?skus=${skus.map(encodeURIComponent).join(",")}` : "/compare");

// Adds the SKU (dropping the oldest past the limit) or removes it when it is already there.
export function toggleCompare(list: string[], sku: string): string[] {
  if (!SKU.test(sku)) return list;
  if (list.includes(sku)) return list.filter((s) => s !== sku);
  return [...list, sku].slice(-COMPARE_MAX);
}

export type CompareColumn = { sku: string; specs: { name: string; value: string }[] };
export type CompareRow = { name: string; values: string[]; differs: boolean };

// One row per specification any product has, in first-seen order; "" where a product lacks it.
export function compareRows(columns: CompareColumn[]): CompareRow[] {
  const names: string[] = [];
  for (const c of columns) for (const s of c.specs) if (!names.includes(s.name)) names.push(s.name);
  return names.map((name) => {
    const values = columns.map((c) => c.specs.find((s) => s.name === name)?.value ?? "");
    return { name, values, differs: new Set(values).size > 1 };
  });
}

// Downloads: the variant's commercetools Assets (Merchant Center: Variants → Assets), https sources only, one link
// per asset (its first source of a known document type, else its first https source).
export type Download = { name: string; url: string; kind: string };
type AssetLike = { name: Record<string, string>; sources: { uri: string; key?: string; contentType?: string }[] };

const KINDS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/zip": "ZIP",
  "image/vnd.dwg": "DWG",
  "model/step": "STEP",
  "text/csv": "CSV",
};
const kindOf = (s: { uri: string; contentType?: string }) =>
  (s.contentType && KINDS[s.contentType]) ?? s.uri.split("?")[0].split(".").pop()?.toUpperCase().slice(0, 5) ?? "File";

export function downloadsOf(assets: AssetLike[] | undefined, locale: string): Download[] {
  return (assets ?? []).flatMap((a) => {
    const https = a.sources.filter((s) => {
      try {
        return new URL(s.uri).protocol === "https:";
      } catch {
        return false;
      }
    });
    const source = https.find((s) => s.contentType && KINDS[s.contentType]) ?? https[0];
    if (!source) return [];
    const name = a.name[locale] ?? Object.values(a.name)[0] ?? "Download";
    return [{ name, url: source.uri, kind: kindOf(source) }];
  });
}
