"use server";

// Public endpoint for company budgets: signed-in business context, the feature switch, rate limit, input
// validation, then the service, which checks UpdateBusinessUnitDetails live in the selected unit.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireBusinessContext } from "@/features/business-units/context";
import { BudgetError, saveBudgets } from "@/features/spending-limits/service";
import { currencyDigits, parseRule, spendingLimitsEnabled, type BudgetRule } from "@/features/spending-limits/budget";

export type BudgetFormState = { error?: string; saved?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_BUYERS = 200;

export async function saveBudgetsAction(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  if (!spendingLimitsEnabled()) return { error: "Budgets are not available." };
  const { session, context } = await requireBusinessContext();
  if (await tooManyAttempts(`budgets:${session.customerId}`, 30))
    return { error: "Too many changes. Please wait a few minutes and try again." };

  const digits = currencyDigits(context.currency);
  const field = (k: string) => (typeof formData.get(k) === "string" ? String(formData.get(k)) : undefined);
  const unit = parseRule({ amount: field("unit.amount"), period: field("unit.period"), mode: field("unit.mode") }, digits);
  if (!unit.ok) return { error: `Company ${unit.error.charAt(0).toLowerCase()}${unit.error.slice(1)}` };

  const ids = [...new Set(formData.getAll("buyer").map(String))];
  if (ids.length > MAX_BUYERS || ids.some((id) => !UUID.test(id))) return { error: "The form is out of date. Please reload." };
  const buyers: Record<string, BudgetRule> = {};
  for (const id of ids) {
    const r = parseRule({ amount: field(`${id}.amount`), period: field(`${id}.period`), mode: field(`${id}.mode`) }, digits);
    if (!r.ok) return { error: r.error };
    if (r.rule) buyers[id] = r.rule;
  }

  try {
    await saveBudgets(context, session.customerId, unit.rule, buyers);
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof BudgetError) return { error: err.message };
    console.error("budgets update failed", (err as { body?: unknown })?.body ?? err);
    return { error: "The budgets could not be saved. Please try again." };
  }
  refresh();
  return { saved: "You saved the budgets." };
}
