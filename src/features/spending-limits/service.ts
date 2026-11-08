import "server-only";
import { cache } from "react";
import { apiRoot } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import { formatMoney } from "@/lib/utils";
import { businessUnitNow, hasPermissionNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import {
  BUDGET_CONTAINER,
  currencyDigits,
  decide,
  decisionMessage,
  parseBudgetDoc,
  periodBounds,
  spendingLimitsEnabled,
  spent,
  status,
  type BudgetDecision,
  type BudgetDoc,
  type BudgetRule,
  type BudgetStatus,
} from "@/features/spending-limits/budget";

// Spending budgets (docs/features/spending-limits.md). The Custom Object is read and written with the admin client,
// always for the buyer's SELECTED unit (from the session's context), and every write first checks
// UpdateBusinessUnitDetails live. Spent amounts come from the unit's orders, read with the admin client too: the
// customer token only sees the buyer's own orders, and a unit budget counts everyone's.

export class BudgetError extends Error {}

const stored = (unitKey: string) => apiRoot.customObjects().withContainerAndKey({ container: BUDGET_CONTAINER, key: unitKey });

async function readStored(ctx: Pick<PricingContext, "businessUnitKey" | "currency">): Promise<{ doc: BudgetDoc; version?: number }> {
  const digits = currencyDigits(ctx.currency);
  try {
    const { body } = await stored(ctx.businessUnitKey).get().execute();
    return { doc: parseBudgetDoc(body.value, ctx.currency, digits), version: body.version };
  } catch (err) {
    if (statusOf(err) === 404) return { doc: parseBudgetDoc(undefined, ctx.currency, digits) };
    throw err;
  }
}

export const readBudgets = cache(async (ctx: Pick<PricingContext, "businessUnitKey" | "currency">) => (await readStored(ctx)).doc);

type SpendOrder = Parameters<typeof spent>[0][number];
const PAGE = 500;
const MAX_PAGES = 20;

// The unit's non-cancelled orders since `start` (net totals only). 10,000 orders a quarter is far above what a
// storefront budget is for; past that the sum is a lower bound and the event is logged.
async function unitOrdersSince(unitKey: string, start: Date): Promise<SpendOrder[]> {
  const out: SpendOrder[] = [];
  let lastId: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const where = [
      `businessUnit(key=${str(unitKey)})`,
      `createdAt >= ${str(start.toISOString())}`,
      `orderState != "Cancelled"`,
      ...(lastId ? [`id > ${str(lastId)}`] : []),
    ];
    const { body } = await apiRoot
      .orders()
      .get({ queryArgs: { where, sort: ["id asc"], limit: PAGE, withTotal: false } })
      .execute();
    out.push(...(body.results as unknown as SpendOrder[]));
    if (body.results.length < PAGE) return out;
    lastId = body.results.at(-1)!.id;
  }
  console.warn("spending budget: more orders than counted", { unitKey, counted: out.length });
  return out;
}

// What is left of every budget that applies to this buyer in this unit (none: an empty list). Once per render.
export const budgetStatuses = cache(async (ctx: PricingContext, customerId: string): Promise<BudgetStatus[]> => {
  if (!spendingLimitsEnabled() || !ctx.businessUnitKey) return [];
  const doc = await readBudgets(ctx);
  const rules: [BudgetStatus["scope"], BudgetRule][] = [
    ...(doc.unit ? ([["unit", doc.unit]] as [BudgetStatus["scope"], BudgetRule][]) : []),
    ...(doc.buyers[customerId] ? ([["buyer", doc.buyers[customerId]]] as [BudgetStatus["scope"], BudgetRule][]) : []),
  ];
  if (rules.length === 0) return [];
  const now = new Date();
  const bounds = rules.map(([, rule]) => periodBounds(rule.period, now));
  const earliest = new Date(Math.min(...bounds.map((b) => b.start.getTime())));
  const orders = await unitOrdersSince(ctx.businessUnitKey, earliest);
  return rules.map(([scope, rule], i) =>
    status(scope, rule, spent(orders, doc.currency, bounds[i], scope === "buyer" ? customerId : undefined), bounds[i].end),
  );
});

export const budgetMoney = (ctx: Pick<PricingContext, "currency">) => (centAmount: number) =>
  formatMoney({ centAmount, currencyCode: ctx.currency, fractionDigits: currencyDigits(ctx.currency) });

// Checked by placeOrder after repricing, with the order's net total. Read live (React's cache is off in Server
// Actions). Two orders placed at the same moment can both pass: hard enforcement needs an API Extension (see docs).
export async function checkOrderBudget(
  ctx: PricingContext,
  customerId: string,
  orderNet: { centAmount: number; currencyCode: string },
): Promise<BudgetDecision & { message: string }> {
  const statuses = await budgetStatuses(ctx, customerId);
  if (statuses.length === 0 || orderNet.currencyCode !== ctx.currency) return { decision: "ok", over: [], message: "" };
  const d = decide(statuses, orderNet.centAmount);
  const period = (scope: BudgetStatus["scope"]) => statuses.find((s) => s.scope === scope)!.rule.period;
  return { ...d, message: decisionMessage(d, budgetMoney(ctx), period) };
}

// ---------- Company admins ----------

// Everyone's spending this period, for the budgets page. Only for admins (checked live): colleagues' spending
// is company data.
export async function budgetOverview(ctx: PricingContext, actorId: string) {
  const [allowed, doc] = await Promise.all([hasPermissionNow(ctx.businessUnitKey, actorId, "UpdateBusinessUnitDetails"), readBudgets(ctx)]);
  if (!allowed) throw new BudgetError("You can't manage the company's budgets.");
  const now = new Date();
  const earliest = periodBounds("quarterly", now).start;
  const orders = await unitOrdersSince(ctx.businessUnitKey, earliest);
  const spentBy = (rule: BudgetRule, customerId?: string) => spent(orders, doc.currency, periodBounds(rule.period, now), customerId);
  return {
    doc,
    unit: doc.unit && status("unit", doc.unit, spentBy(doc.unit), periodBounds(doc.unit.period, now).end),
    buyers: Object.fromEntries(
      Object.entries(doc.buyers).map(([id, rule]) => [id, status("buyer", rule, spentBy(rule, id), periodBounds(rule.period, now).end)]),
    ),
  };
}

// Replaces the unit's budgets. Buyer budgets only for current members of the unit (read live). The admin's
// permission is checked on every attempt, so a role removed in the meantime stops the write.
export async function saveBudgets(ctx: PricingContext, actorId: string, unit: BudgetRule | undefined, buyers: Record<string, BudgetRule>) {
  for (let attempt = 1; ; attempt++) {
    const [allowed, bu, { version }] = await Promise.all([
      hasPermissionNow(ctx.businessUnitKey, actorId, "UpdateBusinessUnitDetails"),
      businessUnitNow(ctx.businessUnitKey),
      readStored(ctx),
    ]);
    if (!allowed) throw new BudgetError("You can't manage the company's budgets.");
    const members = new Set([...bu.associates, ...(bu.inheritedAssociates ?? [])].map((a) => a.customer.id));
    const strangers = Object.keys(buyers).filter((id) => !members.has(id));
    if (strangers.length > 0) throw new BudgetError("A budget is for someone who is no longer a user of this company. Please reload.");
    const value: BudgetDoc = {
      currency: ctx.currency,
      fractionDigits: currencyDigits(ctx.currency),
      unit,
      buyers,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };
    try {
      await apiRoot
        .customObjects()
        .post({ body: { container: BUDGET_CONTAINER, key: ctx.businessUnitKey, value, ...(version !== undefined && { version }) } })
        .execute();
      return;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 3) throw err;
    }
  }
}
