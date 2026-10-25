"use server";

import { addParsedLines } from "@/features/quick-order/service";
import type { QuickOrderState } from "@/features/quick-order/types";

// Public endpoint: paste "SKU, qty" lines and add them all to the selected unit's cart.
export async function quickOrder(_prev: QuickOrderState, formData: FormData): Promise<QuickOrderState> {
  return addParsedLines(String(formData.get("lines") ?? ""));
}
