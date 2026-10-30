import { describe, expect, it } from "vitest";
import type { ApprovalRule } from "@commercetools/platform-sdk";
import { isFormEditable, ruleUpdateActions, summarize, totalPredicate } from "@/features/company/approval-rule-utils";
import type { ApprovalRuleInput } from "@/features/company/types";

const role = (key: string) => ({ associateRole: { typeId: "associate-role" as const, key } });
const rule = (over: Partial<ApprovalRule> = {}) =>
  ({
    id: "r1",
    version: 3,
    name: "Big orders",
    status: "Active",
    predicate: totalPredicate(10000, "EUR"),
    requesters: [role("buyer")],
    approvers: { tiers: [{ and: [{ or: [role("approver"), role("admin")] }] }] },
    ...over,
  }) as ApprovalRule;
const input = (over: Partial<ApprovalRuleInput> = {}): ApprovalRuleInput => ({
  name: "Big orders",
  description: "",
  active: true,
  amount: 10000,
  requesters: ["buyer"],
  approvers: ["admin", "approver"],
  ...over,
});

describe("totalPredicate", () => {
  it("compares cents in one currency", () =>
    expect(totalPredicate(10000.5, "EUR")).toBe('totalPrice.centAmount > 1000050 and totalPrice.currencyCode = "EUR"'));
});

describe("summarize", () => {
  it("describes a total rule in words", () =>
    expect(summarize(rule())).toMatchObject({
      active: true,
      amount: 10000,
      requesters: ["buyer"],
      approvers: ["approver", "admin"],
      steps: 1,
    }));

  it("shows other predicates as they are", () => {
    const s = summarize(rule({ predicate: "lineItemCount > 5" }));
    expect(s.amount).toBeUndefined();
    expect(s.condition).toBe("Custom condition: lineItemCount > 5");
  });
});

describe("isFormEditable", () => {
  it("accepts one-step total rules only", () => {
    expect(isFormEditable(rule())).toBe(true);
    expect(isFormEditable(rule({ predicate: "lineItemCount > 5" }))).toBe(false);
    const twoSteps = rule().approvers.tiers;
    expect(isFormEditable(rule({ approvers: { tiers: [...twoSteps, ...twoSteps] } }))).toBe(false);
  });
});

describe("ruleUpdateActions", () => {
  it("is empty when nothing changed, whatever the role order", () => expect(ruleUpdateActions(rule(), input(), "EUR")).toEqual([]));

  it("sends only what changed", () =>
    expect(ruleUpdateActions(rule(), input({ active: false, amount: 20000, approvers: ["admin"] }), "EUR").map((a) => a.action)).toEqual([
      "setStatus",
      "setPredicate",
      "setApprovers",
    ]));

  it("clears a description with undefined", () =>
    expect(ruleUpdateActions(rule({ description: "Old" }), input(), "EUR")).toEqual([
      { action: "setDescription", description: undefined },
    ]));
});
