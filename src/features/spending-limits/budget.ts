// Spending budgets per business unit and per buyer (pure, unit-tested). One Custom Object per unit holds them
// (container "spending-budgets", key = unit key); what was spent is computed live from the unit's orders in the
// period, so there is no counter to drift. Amounts are net (before tax), in the unit's currency, as cent amounts.

export const BUDGET_CONTAINER = "spending-budgets";
export const PERIODS = ["monthly", "quarterly"] as const;
export const MODES = ["block", "warn"] as const;
export type Period = (typeof PERIODS)[number];
export type Mode = (typeof MODES)[number];

export type BudgetRule = { period: Period; centAmount: number; mode: Mode };
export type BudgetDoc = {
  currency: string;
  fractionDigits: number;
  unit?: BudgetRule;
  // customer id → their own budget in this unit
  buyers: Record<string, BudgetRule>;
  updatedBy?: string;
  updatedAt?: string;
};

export const spendingLimitsEnabled = (env: Record<string, string | undefined> = process.env) => env.SPENDING_LIMITS === "true";

const isRule = (v: unknown): v is BudgetRule => {
  const r = v as BudgetRule;
  return !!r && PERIODS.includes(r.period) && MODES.includes(r.mode) && Number.isSafeInteger(r.centAmount) && r.centAmount > 0;
};

// A stored value → a budget document; anything malformed is dropped rather than trusted.
export function parseBudgetDoc(value: unknown, currency: string, fractionDigits: number): BudgetDoc {
  const v = (value ?? {}) as Partial<BudgetDoc>;
  // Budgets set in another currency don't apply (the unit's store changed): amounts can't be converted.
  if (v.currency !== undefined && v.currency !== currency) return { currency, fractionDigits, buyers: {} };
  const buyers: Record<string, BudgetRule> = {};
  for (const [id, rule] of Object.entries(v.buyers ?? {})) if (/^[0-9a-f-]{36}$/.test(id) && isRule(rule)) buyers[id] = rule;
  return {
    currency,
    fractionDigits,
    unit: isRule(v.unit) ? v.unit : undefined,
    buyers,
    updatedBy: typeof v.updatedBy === "string" ? v.updatedBy : undefined,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

// The period that contains `now`, in UTC: [start, end).
export function periodBounds(period: Period, now: Date): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = period === "monthly" ? now.getUTCMonth() : Math.floor(now.getUTCMonth() / 3) * 3;
  const months = period === "monthly" ? 1 : 3;
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + months, 1)) };
}

type OrderLike = {
  orderState: string;
  createdAt: string;
  customerId?: string;
  totalPrice: { centAmount: number; currencyCode: string };
  taxedPrice?: { totalNet: { centAmount: number; currencyCode: string } };
};

export const netOf = (o: Pick<OrderLike, "totalPrice" | "taxedPrice">) => o.taxedPrice?.totalNet ?? o.totalPrice;

// Net spent by non-cancelled orders in [start, end), optionally by one buyer.
export function spent(orders: OrderLike[], currency: string, bounds: { start: Date; end: Date }, customerId?: string): number {
  const from = bounds.start.getTime();
  const to = bounds.end.getTime();
  return orders
    .filter((o) => o.orderState !== "Cancelled")
    .filter((o) => !customerId || o.customerId === customerId)
    .filter((o) => {
      const t = Date.parse(o.createdAt);
      return t >= from && t < to;
    })
    .map(netOf)
    .filter((m) => m.currencyCode === currency)
    .reduce((sum, m) => sum + m.centAmount, 0);
}

export type BudgetStatus = {
  scope: "unit" | "buyer";
  rule: BudgetRule;
  spent: number;
  remaining: number;
  periodEnd: string;
};

export const status = (scope: BudgetStatus["scope"], rule: BudgetRule, spentCents: number, periodEnd: Date): BudgetStatus => ({
  scope,
  rule,
  spent: spentCents,
  remaining: rule.centAmount - spentCents,
  periodEnd: periodEnd.toISOString(),
});

export type BudgetDecision = { decision: "ok" | "warn" | "block"; over: { scope: BudgetStatus["scope"]; by: number }[] };

// Whether an order of `orderCents` (net) fits every budget that applies. A budget in block mode refuses; warn mode
// lets it through with a warning. The most severe answer wins.
export function decide(statuses: BudgetStatus[], orderCents: number): BudgetDecision {
  const over = statuses
    .filter((s) => orderCents > s.remaining)
    .map((s) => ({ scope: s.scope, by: orderCents - Math.max(s.remaining, 0), mode: s.rule.mode }));
  const decision = over.some((o) => o.mode === "block") ? "block" : over.length > 0 ? "warn" : "ok";
  return { decision, over: over.map(({ scope, by }) => ({ scope, by })) };
}

const LABEL = { unit: "the company's", buyer: "your" } as const;

export function decisionMessage(d: BudgetDecision, money: (cents: number) => string, period: (scope: "unit" | "buyer") => Period) {
  const parts = d.over.map((o) => `${LABEL[o.scope]} ${period(o.scope) === "monthly" ? "monthly" : "quarterly"} budget by ${money(o.by)}`);
  if (parts.length === 0) return "";
  return d.decision === "block"
    ? `This order exceeds ${parts.join(" and ")}. Reduce the order or ask a company admin to raise the budget.`
    : `This order exceeds ${parts.join(" and ")}. It was placed; your company admin can see it.`;
}

// Form input for one budget row → a rule, nothing (empty amount = no budget) or a problem in words.
export function parseRule(
  input: { amount?: string; period?: string; mode?: string },
  fractionDigits: number,
): { ok: true; rule?: BudgetRule } | { ok: false; error: string } {
  const amount = (input.amount ?? "").trim().replace(/[\s,]/g, "");
  if (!amount) return { ok: true };
  const pattern = fractionDigits > 0 ? new RegExp(`^\\d{1,12}(\\.\\d{1,${fractionDigits}})?$`) : /^\d{1,12}$/;
  if (!pattern.test(amount)) return { ok: false, error: "Budget: enter an amount such as 5000 or 5000.50." };
  const [whole, frac = ""] = amount.split(".");
  const centAmount = Number(whole) * 10 ** fractionDigits + Number(frac.padEnd(fractionDigits, "0") || 0);
  if (!Number.isSafeInteger(centAmount) || centAmount <= 0) return { ok: false, error: "Budget: enter an amount above zero." };
  const period = input.period as Period;
  const mode = input.mode as Mode;
  if (!PERIODS.includes(period)) return { ok: false, error: "Budget: choose monthly or quarterly." };
  if (!MODES.includes(mode)) return { ok: false, error: "Budget: choose whether an order over budget is blocked or allowed." };
  return { ok: true, rule: { period, centAmount, mode } };
}

// A cent amount as a form value (no grouping, so it parses back).
export const amountInput = (cents: number, fractionDigits: number) =>
  fractionDigits > 0 ? (cents / 10 ** fractionDigits).toFixed(fractionDigits) : String(cents);

// The currency's minor-unit digits (EUR 2, JPY 0), as commercetools uses them.
export const currencyDigits = (currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
