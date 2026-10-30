import type { ApprovalRule, ApprovalRuleUpdateAction } from "@commercetools/platform-sdk";
import { formatMoney } from "@/lib/utils";
import type { ApprovalRuleInput, ApprovalRuleSummary } from "@/features/company/types";

// Pure parts of the approval rules (no API calls), unit-tested. The calls are in approval-rules.ts.

// "Order total above X": the only condition the form builds. Other predicates (made elsewhere) are shown as is.
const TOTAL = /^totalPrice\.centAmount > (\d+) and totalPrice\.currencyCode = "([A-Z]{3})"$/;
export const totalPredicate = (amount: number, currency: string) =>
  `totalPrice.centAmount > ${Math.round(amount * 100)} and totalPrice.currencyCode = "${currency}"`;

// The form only represents "order total above" rules with one approval step; never overwrite others with it.
export const isFormEditable = (rule: Pick<ApprovalRule, "predicate" | "approvers">) =>
  TOTAL.test(rule.predicate) && rule.approvers.tiers.length === 1;

export function summarize(rule: ApprovalRule): ApprovalRuleSummary {
  const total = TOTAL.exec(rule.predicate);
  return {
    id: rule.id,
    version: rule.version,
    name: rule.name,
    description: rule.description,
    active: rule.status === "Active",
    amount: total ? Number(total[1]) / 100 : undefined,
    condition: total
      ? `Order total above ${formatMoney({ centAmount: Number(total[1]), currencyCode: total[2], fractionDigits: 2 })}`
      : `Custom condition: ${rule.predicate}`,
    requesters: rule.requesters.map((r) => r.associateRole.key),
    // One step, any of these roles (the form's shape); further steps or AND-groups made elsewhere are flattened for display.
    approvers: [...new Set(rule.approvers.tiers.flatMap((t) => t.and.flatMap((d) => d.or.map((o) => o.associateRole.key))))],
    steps: rule.approvers.tiers.length,
  };
}

const role = (key: string) => ({ associateRole: { typeId: "associate-role" as const, key } });
export const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));

// The rule as the form describes it, in the unit's currency.
export function ruleDraft(input: ApprovalRuleInput, currency: string) {
  return {
    predicate: totalPredicate(input.amount, currency),
    approvers: { tiers: [{ and: [{ or: input.approvers.map(role) }] }] },
    requesters: input.requesters.map(role),
    status: input.active ? ("Active" as const) : ("Inactive" as const),
  };
}

// Update actions that turn `current` into what the form submitted (empty when nothing changed).
export function ruleUpdateActions(current: ApprovalRule, input: ApprovalRuleInput, currency: string): ApprovalRuleUpdateAction[] {
  const draft = ruleDraft(input, currency);
  const { approvers: currentApprovers, requesters: currentRequesters } = summarize(current);
  const actions: ApprovalRuleUpdateAction[] = [];
  if (current.name !== input.name) actions.push({ action: "setName", name: input.name });
  if ((current.description ?? "") !== input.description)
    actions.push({ action: "setDescription", description: input.description || undefined });
  if (current.status !== draft.status) actions.push({ action: "setStatus", status: draft.status });
  if (current.predicate !== draft.predicate) actions.push({ action: "setPredicate", predicate: draft.predicate });
  if (!sameSet(currentApprovers, input.approvers)) actions.push({ action: "setApprovers", approvers: draft.approvers });
  if (!sameSet(currentRequesters, input.requesters)) actions.push({ action: "setRequesters", requesters: draft.requesters });
  return actions;
}
