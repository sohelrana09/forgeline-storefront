"use server";

import { actorKey, requireBrowseContext } from "@/features/business-units/context";
import { addParsedLines } from "@/features/quick-order/service";
import type { QuickOrderState } from "@/features/quick-order/types";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";

// Public endpoint: paste "SKU, qty" lines and add them all to the selected unit's cart. Each call can read up to 500
// products, so it is limited per visitor and per address.
export async function quickOrder(_prev: QuickOrderState, formData: FormData): Promise<QuickOrderState> {
  const browse = await requireBrowseContext();
  if (
    (await tooManyAttempts(`quick-order:${actorKey(browse)}`, 30)) ||
    (await tooManyAttempts(`quick-order-ip:${await clientIp()}`, 120))
  ) {
    return { added: [], errors: [{ line: 0, text: "", reason: "Too many attempts. Please wait a few minutes and try again." }] };
  }
  return addParsedLines(String(formData.get("lines") ?? ""));
}
