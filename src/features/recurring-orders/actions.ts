"use server";

// Public endpoints for recurring orders: the feature switch, a signed-in business context, a rate limit, input
// validation, then the service (live permission checks, ownership of every recurring order it touches).

import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { flash } from "@/lib/flash";
import { requireBusinessContext } from "@/features/business-units/context";
import { OPS, parseStartsAt, recurringOrdersEnabled, type RecurringOp } from "@/features/recurring-orders/schedule";
import { RecurringOrderError, changeRecurringOrder, createRecurringOrder } from "@/features/recurring-orders/service";

export type RecurringFormState = { error?: string; saved?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const POLICY_KEY = /^[A-Za-z0-9_-]{2,256}$/;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

const failed = (err: unknown, what: string): RecurringFormState => {
  unstable_rethrow(err);
  if (err instanceof RecurringOrderError) return { error: err.message };
  console.error(`recurring order ${what} failed`, (err as { body?: unknown })?.body ?? err);
  return { error: "That didn't work. Please try again." };
};

export async function createRecurringOrderAction(_prev: RecurringFormState, formData: FormData): Promise<RecurringFormState> {
  if (!recurringOrdersEnabled()) return { error: "Recurring orders are not available." };
  const { session, context } = await requireBusinessContext();
  if (await tooManyAttempts(`recurring-create:${session.customerId}`, 10)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  const kind = text(formData, "sourceKind");
  const id = text(formData, "sourceId");
  const policy = text(formData, "policy");
  if ((kind !== "order" && kind !== "list") || !UUID.test(id)) return { error: "The form is out of date. Please reload." };
  if (!POLICY_KEY.test(policy)) return { error: "Choose how often to order." };
  const start = parseStartsAt(text(formData, "startsAt"), new Date());
  if (!start.ok) return { error: start.error };
  const source =
    kind === "order"
      ? { kind: "order" as const, id }
      : { kind: "list" as const, id, scope: text(formData, "listScope") === "company" ? ("company" as const) : ("mine" as const) };
  try {
    const { label } = await createRecurringOrder(session, context, source, policy, start.startsAt);
    await flash("success", `You set up a recurring order from ${label}.`);
  } catch (err) {
    return failed(err, "create");
  }
  redirect("/account/recurring-orders");
}

const DONE: Record<RecurringOp, string> = {
  pause: "You paused the recurring order.",
  resume: "You resumed the recurring order.",
  skip: "The next order will be skipped.",
  cancel: "You cancelled the recurring order.",
};

export async function changeRecurringOrderAction(_prev: RecurringFormState, formData: FormData): Promise<RecurringFormState> {
  if (!recurringOrdersEnabled()) return { error: "Recurring orders are not available." };
  const { session, context } = await requireBusinessContext();
  if (await tooManyAttempts(`recurring-change:${session.customerId}`, 30)) {
    return { error: "Too many changes. Please wait a few minutes and try again." };
  }
  const id = text(formData, "id");
  const op = text(formData, "op") as RecurringOp;
  if (!UUID.test(id) || !OPS.includes(op)) return { error: "The form is out of date. Please reload." };
  try {
    await changeRecurringOrder(session, context, id, op);
  } catch (err) {
    return failed(err, op);
  }
  refresh();
  return { saved: DONE[op] };
}
