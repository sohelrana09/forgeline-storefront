"use server";

// Public endpoints for the company's equipment list: a signed-in business context, a rate limit, input checks, then
// the service (live permission check on every write).

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireBusinessContext } from "@/features/business-units/context";
import { EquipmentError, changeEquipment } from "@/features/fitment/service";
import type { EquipmentChange } from "@/features/fitment/fitment";

export type EquipmentFormState = { error?: string; saved?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function changeEquipmentAction(_prev: EquipmentFormState, formData: FormData): Promise<EquipmentFormState> {
  const { session, context } = await requireBusinessContext();
  if (await tooManyAttempts(`equipment:${session.customerId}`, 60)) return { error: "Too many changes. Please wait a few minutes." };
  const op = text(formData, "op");
  let change: EquipmentChange;
  if (op === "add") {
    const machineId = text(formData, "machineId");
    if (!/^[0-9a-f-]{36}$/.test(machineId)) return { error: "Choose a machine from the list." };
    change = { op, item: { machineId, label: text(formData, "label") || undefined, serial: text(formData, "serial") || undefined } };
  } else if (op === "remove") {
    const index = Number(text(formData, "index"));
    if (!Number.isInteger(index) || index < 0) return { error: "The form is out of date. Please reload." };
    change = { op, index };
  } else return { error: "The form is out of date. Please reload." };
  try {
    const label = await changeEquipment(context, session.customerId, change);
    refresh();
    return { saved: op === "add" ? `You added ${label}.` : `You removed ${label}.` };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof EquipmentError) return { error: err.message };
    console.error("equipment change failed", (err as { body?: unknown })?.body ?? err);
    return { error: "That didn't work. Please try again." };
  }
}
