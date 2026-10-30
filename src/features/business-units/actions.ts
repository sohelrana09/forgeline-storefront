"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { BU_COOKIE, cookieOptions } from "@/features/auth/session";
import { currentBuyingContext } from "@/features/business-units/context";

// Public endpoint: switch the selected business unit, only among the customer's own units.
export async function selectBusinessUnit(formData: FormData) {
  const key = String(formData.get("businessUnit") ?? "");
  const current = await currentBuyingContext();
  if (!current?.contexts.some((c) => c.businessUnitKey === key)) return;
  (await cookies()).set(BU_COOKIE, key, cookieOptions);
  refresh();
}
