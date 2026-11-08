import type { RecurrencePolicySchedule, RecurringOrder } from "@commercetools/platform-sdk";

// Recurring orders through native commercetools Recurring Orders (docs/features/recurring-orders.md). Pure,
// unit-tested: frequency labels, the first-run window, which actions a state allows, and when the reminder goes.

export const recurringOrdersEnabled = (env: Record<string, string | undefined> = process.env) => env.RECURRING_ORDERS === "true";

// Hours before a run when the reminder email goes out (the daily cron sends it once per run).
export const REMINDER_LEAD_HOURS = 48;
export const REMINDER_CONTAINER = "recurring-reminder";

const UNIT = { Days: ["day", "days"], Weeks: ["week", "weeks"], Months: ["month", "months"] } as Record<string, [string, string]>;

export function scheduleLabel(schedule: RecurrencePolicySchedule | { type: string; value?: number; intervalUnit?: string }): string {
  const s = schedule as { type: string; value?: number; intervalUnit?: string; day?: number };
  if (s.type === "standard" && s.value && s.intervalUnit && UNIT[s.intervalUnit]) {
    const [one, many] = UNIT[s.intervalUnit];
    return s.value === 1 ? `Every ${one}` : `Every ${s.value} ${many}`;
  }
  if (s.type === "dayOfMonth" && s.day) return `Monthly on day ${s.day}`;
  return "Custom schedule";
}

// Sorted shortest interval first, so the picker reads weekly → yearly.
export function policyOptions(policies: { key?: string; schedule: RecurrencePolicySchedule }[]): { key: string; label: string }[] {
  const days = (s: { type: string; value?: number; intervalUnit?: string }) =>
    s.type === "standard" ? (s.value ?? 0) * ({ Days: 1, Weeks: 7, Months: 30 }[s.intervalUnit ?? ""] ?? 0) : 30;
  return policies
    .filter((p): p is { key: string; schedule: RecurrencePolicySchedule } => Boolean(p.key))
    .sort((a, b) => days(a.schedule as never) - days(b.schedule as never))
    .map((p) => ({ key: p.key, label: scheduleLabel(p.schedule) }));
}

const day = (d: Date) => d.toISOString().slice(0, 10);

// The first run: a day from tomorrow up to one year ahead (UTC), as an ISO timestamp at 06:00 UTC that day.
export function firstRunWindow(now: Date) {
  const min = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const max = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  return { min: day(min), max: day(max) };
}

export function parseStartsAt(input: string | undefined, now: Date): { ok: true; startsAt: string } | { ok: false; error: string } {
  const s = (input ?? "").trim();
  const { min, max } = firstRunWindow(now);
  const parsed = new Date(`${s}T00:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parsed.getTime()) && day(parsed) === s;
  if (!valid || s < min || s > max) return { ok: false, error: "First order: choose a day from tomorrow up to one year ahead." };
  return { ok: true, startsAt: `${s}T06:00:00.000Z` };
}

export type RecurringOp = "pause" | "resume" | "skip" | "cancel";
export const OPS: RecurringOp[] = ["pause", "resume", "skip", "cancel"];

// What the buyer may do in each state. Failed ones can be resumed once the cause is fixed (commercetools doesn't
// retry them on its own).
export function allowedOps(state: RecurringOrder["recurringOrderState"]): RecurringOp[] {
  if (state === "Active") return ["pause", "skip", "cancel"];
  if (state === "Paused" || state === "Failed") return ["resume", "cancel"];
  return [];
}

// The update for one operation. Skipping skips the next order (a counter of one more than already pending).
export function opAction(op: RecurringOp, current: Pick<RecurringOrder, "skipConfiguration">) {
  switch (op) {
    case "pause":
      return { action: "setRecurringOrderState" as const, recurringOrderState: { type: "paused" as const } };
    case "resume":
      return { action: "setRecurringOrderState" as const, recurringOrderState: { type: "active" as const } };
    case "cancel":
      return {
        action: "setRecurringOrderState" as const,
        recurringOrderState: { type: "canceled" as const, reason: "Cancelled by the buyer" },
      };
    case "skip": {
      const pending = current.skipConfiguration ? current.skipConfiguration.totalToSkip - current.skipConfiguration.skipped : 0;
      return {
        action: "setOrderSkipConfiguration" as const,
        skipConfigurationInputDraft: { type: "Counter" as const, totalToSkip: Math.max(pending, 0) + 1 },
      };
    }
  }
}

// Skipped runs still to come.
export const pendingSkips = (r: Pick<RecurringOrder, "skipConfiguration">) =>
  r.skipConfiguration ? Math.max(r.skipConfiguration.totalToSkip - r.skipConfiguration.skipped, 0) : 0;

// Due for its reminder: active, the next run within the lead time and still ahead, and not a skipped run.
export function reminderDue(r: Pick<RecurringOrder, "recurringOrderState" | "nextOrderAt" | "skipConfiguration">, now: Date): boolean {
  if (r.recurringOrderState !== "Active" || !r.nextOrderAt || pendingSkips(r) > 0) return false;
  const at = Date.parse(r.nextOrderAt);
  return at > now.getTime() && at - now.getTime() <= REMINDER_LEAD_HOURS * 3_600_000;
}

// One reminder per run: the marker key names the recurring order and the run's day.
export const reminderKey = (r: Pick<RecurringOrder, "id" | "nextOrderAt">) => `${r.id}-${(r.nextOrderAt ?? "").slice(0, 10)}`;

// Lines to copy into the recurring cart: available SKUs, quantities 1 to 9,999, merged per SKU, at most 100.
export function recurringLines(lines: { sku?: string; quantity: number; available?: boolean }[]): { sku: string; quantity: number }[] {
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (!l.sku || l.available === false || !Number.isInteger(l.quantity) || l.quantity < 1) continue;
    merged.set(l.sku, Math.min((merged.get(l.sku) ?? 0) + l.quantity, 9999));
  }
  return [...merged].slice(0, 100).map(([sku, quantity]) => ({ sku, quantity }));
}

export const STATE_LABEL: Record<string, string> = {
  Active: "Active",
  Paused: "Paused",
  Failed: "Stopped (needs attention)",
  Canceled: "Cancelled",
  Expired: "Ended",
};
