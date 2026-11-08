"use server";

import { actorKey, currentBrowseContext } from "@/features/business-units/context";
import { lookupSkus } from "@/features/cart/service";
import { parseQuickOrder } from "@/features/quick-order/parser";
import { checkPdf, checkText, poImportEnabled, type PoInput } from "@/features/po-import/po";
import { extractPurchaseOrder, PoImportError } from "@/features/po-import/service";
import type { PoImportState } from "@/features/po-import/types";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

// Public endpoint: read a pasted or uploaded purchase order into quick-order lines. Signed-in buyers who can order
// only; each call is a paid model request, so it is limited per customer and per address. It adds nothing to a cart:
// the lines come back for the quick-order box, where the buyer checks them and adds them with the usual button.
export async function importPurchaseOrder(_prev: PoImportState, formData: FormData): Promise<PoImportState> {
  if (!poImportEnabled()) return { error: "Reading purchase orders isn't available." };
  const browse = await currentBrowseContext();
  const { context, session } = browse;
  if (!session || context.guest) return { error: "Sign in to read a purchase order." };
  if (!context.canOrder) return { error: `You don't have the buyer role in ${context.businessUnitName}.` };
  if ((await tooManyAttempts(`po-import:${actorKey(browse)}`, 10)) || (await tooManyAttempts(`po-import-ip:${await clientIp()}`, 30)))
    return { error: "Too many purchase orders read. Please wait a few minutes and try again." };

  const input = await readInput(formData);
  const poText = "kind" in input && input.kind === "text" ? input.text : undefined;
  if ("error" in input) return { ...input, poText: String(formData.get("poText") ?? "").slice(0, 20_000) || undefined };

  try {
    const result = await extractPurchaseOrder(input);
    if (result.count === 0) return { error: "No order lines with a part number and quantity were found.", skipped: result.skipped, poText };
    // Preview: which part numbers this shop doesn't sell, before anything is added.
    const { lines } = parseQuickOrder(result.text);
    const found = await lookupSkus(
      context,
      lines.map((l) => l.sku),
    );
    const unknown = lines.map((l) => l.sku).filter((sku) => !found.has(sku));
    return { text: result.text, count: result.count, skipped: result.skipped, unknown };
  } catch (err) {
    if (err instanceof PoImportError) return { error: err.message, poText };
    throw err;
  }
}

async function readInput(formData: FormData): Promise<PoInput | { error: string }> {
  const file = formData.get("po");
  if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const problem = checkPdf(bytes);
    return problem ? { error: problem } : { kind: "pdf", data: bytes };
  }
  const text = String(formData.get("poText") ?? "");
  const problem = checkText(text);
  return problem ? { error: problem } : { kind: "text", text };
}
