// SAP OCI (Open Catalog Interface 4.0) return fields, pure and unit-tested: the cart goes back as a form post to the
// HOOK_URL with NEW_ITEM-<FIELD>[n] fields (1-based).

export type OciLine = { sku: string; name: string; quantity: number; unitPrice: string; currency: string; unit?: string; lineId: string };

// Field lengths per OCI 4.0: DESCRIPTION 40, VENDORMAT 40, EXT_PRODUCT_ID 40, UNIT 3.
const cut = (s: string, n: number) => s.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, n);

export function ociFields(lines: OciLine[], extra: { target?: string; caller?: string } = {}): [string, string][] {
  const fields: [string, string][] = [];
  lines.forEach((l, i) => {
    const n = `[${i + 1}]`;
    fields.push(
      [`NEW_ITEM-DESCRIPTION${n}`, cut(l.name, 40)],
      [`NEW_ITEM-QUANTITY${n}`, String(l.quantity)],
      [`NEW_ITEM-UNIT${n}`, cut(l.unit ?? "EA", 3)],
      [`NEW_ITEM-PRICE${n}`, l.unitPrice],
      [`NEW_ITEM-PRICEUNIT${n}`, "1"],
      [`NEW_ITEM-CURRENCY${n}`, cut(l.currency, 5)],
      [`NEW_ITEM-VENDORMAT${n}`, cut(l.sku, 40)],
      [`NEW_ITEM-EXT_PRODUCT_ID${n}`, cut(l.sku, 40)],
      [`NEW_ITEM-LONGTEXT_${i + 1}:132[]`, cut(l.name, 132)],
    );
  });
  if (extra.target) fields.push(["~TARGET", cut(extra.target, 40)]);
  if (extra.caller) fields.push(["~CALLER", cut(extra.caller, 40)]);
  fields.push(["~OKCODE", "ADDI"]);
  return fields;
}

// The OCI setup call (GET or POST from the buyer's system): the hook and the credentials.
export function parseOciSetup(params: URLSearchParams) {
  const get = (k: string) => params.get(k) ?? params.get(k.toLowerCase()) ?? undefined;
  return {
    hookUrl: get("HOOK_URL"),
    username: get("USERNAME"),
    password: get("PASSWORD"),
    target: get("~TARGET") ?? get("~target"),
    caller: get("~CALLER") ?? get("~caller"),
  };
}
