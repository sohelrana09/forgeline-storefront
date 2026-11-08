import { describe, expect, it } from "vitest";
import {
  allowedOps,
  firstRunWindow,
  opAction,
  parseStartsAt,
  pendingSkips,
  policyOptions,
  recurringLines,
  recurringOrdersEnabled,
  reminderDue,
  reminderKey,
  scheduleLabel,
} from "@/features/recurring-orders/schedule";

const now = new Date("2026-11-08T10:00:00Z");

describe("scheduleLabel / policyOptions", () => {
  it("words standard and day-of-month schedules", () => {
    expect(scheduleLabel({ type: "standard", value: 1, intervalUnit: "Months" })).toBe("Every month");
    expect(scheduleLabel({ type: "standard", value: 3, intervalUnit: "Months" })).toBe("Every 3 months");
    expect(scheduleLabel({ type: "standard", value: 2, intervalUnit: "Weeks" })).toBe("Every 2 weeks");
    expect(scheduleLabel({ type: "other" })).toBe("Custom schedule");
  });
  it("sorts the project's policies shortest first and drops ones without a key", () => {
    const s = (value: number, intervalUnit: string) => ({ type: "standard", value, intervalUnit }) as never;
    expect(
      policyOptions([
        { key: "policy-yearly", schedule: s(12, "Months") },
        { key: "policy-weekly", schedule: s(1, "Weeks") },
        { schedule: s(1, "Days") },
        { key: "policy-monthly", schedule: s(1, "Months") },
      ]).map((o) => o.key),
    ).toEqual(["policy-weekly", "policy-monthly", "policy-yearly"]);
  });
});

describe("parseStartsAt", () => {
  it("accepts tomorrow up to a year ahead, at 06:00 UTC", () => {
    expect(firstRunWindow(now)).toEqual({ min: "2026-11-09", max: "2027-11-08" });
    expect(parseStartsAt("2026-11-09", now)).toEqual({ ok: true, startsAt: "2026-11-09T06:00:00.000Z" });
  });
  it("refuses today, the past, far ahead and nonsense", () => {
    for (const d of ["2026-11-08", "2026-01-01", "2027-11-09", "2026-13-01", "", undefined]) expect(parseStartsAt(d, now).ok).toBe(false);
  });
});

describe("operations", () => {
  it("offers what each state allows", () => {
    expect(allowedOps("Active")).toEqual(["pause", "skip", "cancel"]);
    expect(allowedOps("Failed")).toEqual(["resume", "cancel"]);
    expect(allowedOps("Canceled")).toEqual([]);
  });
  it("builds the commercetools updates", () => {
    expect(opAction("pause", {})).toEqual({ action: "setRecurringOrderState", recurringOrderState: { type: "paused" } });
    expect(opAction("resume", {})).toEqual({ action: "setRecurringOrderState", recurringOrderState: { type: "active" } });
    expect(opAction("skip", {})).toEqual({
      action: "setOrderSkipConfiguration",
      skipConfigurationInputDraft: { type: "Counter", totalToSkip: 1 },
    });
    expect(opAction("skip", { skipConfiguration: { type: "Counter", totalToSkip: 3, skipped: 2 } })).toMatchObject({
      skipConfigurationInputDraft: { totalToSkip: 2 },
    });
  });
  it("counts skips still to come", () =>
    expect(pendingSkips({ skipConfiguration: { type: "Counter", totalToSkip: 2, skipped: 1 } })).toBe(1));
});

describe("reminders", () => {
  const r = (over: object) => ({ id: "r1", recurringOrderState: "Active", nextOrderAt: "2026-11-09T06:00:00.000Z", ...over }) as never;
  it("is due within 48 hours of an active run", () => {
    expect(reminderDue(r({}), now)).toBe(true);
    expect(reminderDue(r({ nextOrderAt: "2026-11-11T06:00:00.000Z" }), now)).toBe(false);
    expect(reminderDue(r({ nextOrderAt: "2026-11-08T09:00:00.000Z" }), now)).toBe(false);
  });
  it("skips paused orders and skipped runs", () => {
    expect(reminderDue(r({ recurringOrderState: "Paused" }), now)).toBe(false);
    expect(reminderDue(r({ skipConfiguration: { type: "Counter", totalToSkip: 1, skipped: 0 } }), now)).toBe(false);
  });
  it("names one marker per run", () => expect(reminderKey({ id: "r1", nextOrderAt: "2026-11-09T06:00:00.000Z" })).toBe("r1-2026-11-09"));
});

describe("recurringLines", () => {
  it("merges SKUs and drops unavailable or odd lines", () => {
    expect(
      recurringLines([
        { sku: "a", quantity: 2 },
        { sku: "a", quantity: 3 },
        { sku: "b", quantity: 1, available: false },
        { quantity: 1 },
        { sku: "c", quantity: 0 },
        { sku: "d", quantity: 9000 },
        { sku: "d", quantity: 9000 },
      ]),
    ).toEqual([
      { sku: "a", quantity: 5 },
      { sku: "d", quantity: 9999 },
    ]);
  });
  it("is off unless RECURRING_ORDERS=true", () => expect(recurringOrdersEnabled({})).toBe(false));
});
