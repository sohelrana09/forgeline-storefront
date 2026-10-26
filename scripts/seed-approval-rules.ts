// Demo approval rule (E5): orders above a threshold placed by a Buyer need an Approver's (or Admin's) approval.
// Idempotent by rule key in the business unit; prints created / updated / unchanged.
//   npm run ct:seed-approval-rules                                   lifttech-solutions-ltd-es, €10,000, Active
//   npm run ct:seed-approval-rules -- --bu <unit key> --threshold 5000 [--inactive]
// Rules are created "as associate" with a member of the unit who holds an approver role (commercetools checks their
// CreateApprovalRules / UpdateApprovalRules permission). Rules can't be deleted: --inactive switches one off.
import type { ApprovalRule, ApprovalRuleDraft, ApprovalRuleUpdateAction } from "@commercetools/platform-sdk";
import { apiRoot, asAssociate } from "../src/lib/commercetools/client";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const unitKey = arg("--bu") ?? "lifttech-solutions-ltd-es";
const threshold = Number(arg("--threshold") ?? 10000);
const status = args.includes("--inactive") ? "Inactive" : "Active";
// The unit's currency decides the predicate; units sell in one currency (STORE_PRICING in business-units/service.ts).
const CURRENCY: Record<string, string> = {
  "lifttech-solutions-ltd": "GBP",
  "lifttech-solutions-ltd-de": "EUR",
  "lifttech-solutions-ltd-es": "EUR",
  "lifttech-solutions-ltd-fr": "EUR",
  "liberty-crane-solutions-llc-us": "USD",
  "eagle-heavy-lift-technologies-inc-us": "USD",
};
const role = (key: string) => ({ associateRole: { typeId: "associate-role" as const, key } });

async function main() {
  if (!Number.isInteger(threshold) || threshold <= 0) throw new Error("--threshold must be a whole amount, e.g. 10000");
  const currency = CURRENCY[unitKey];
  if (!currency) throw new Error(`Unknown unit ${unitKey}; add its currency to CURRENCY`);

  // An explicit member with the approver role acts for the script.
  const { body: unit } = await apiRoot.businessUnits().withKey({ key: unitKey }).get().execute();
  const actor = unit.associates.find((a) => a.associateRoleAssignments.some((r) => r.associateRole.key === "approver"));
  if (!actor) throw new Error(`${unitKey} has no explicit associate with the approver role`);
  const rules = asAssociate(actor.customer.id, unitKey).approvalRules();

  const key = `orders-over-${threshold}`;
  const amount = new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(threshold);
  const draft: ApprovalRuleDraft = {
    key,
    name: `Orders over ${amount}`,
    description: `A buyer's order above ${amount} (incl. VAT where prices include it) needs an approver or admin to approve it.`,
    status,
    predicate: `totalPrice.centAmount > ${threshold * 100} and totalPrice.currencyCode = "${currency}"`,
    requesters: [role("buyer")],
    approvers: { tiers: [{ and: [{ or: [role("approver"), role("admin")] }] }] },
  };

  const existing = await rules
    .withKey({ key })
    .get()
    .execute()
    .then((r) => r.body as ApprovalRule)
    .catch((err) => (err?.body?.statusCode === 404 ? undefined : Promise.reject(err)));

  if (!existing) {
    await rules.post({ body: draft }).execute();
    console.log(`+ ${unitKey}: ${draft.name} (${status})`);
    return;
  }
  const actions: ApprovalRuleUpdateAction[] = [];
  if (existing.name !== draft.name) actions.push({ action: "setName", name: draft.name });
  if (existing.description !== draft.description) actions.push({ action: "setDescription", description: draft.description });
  if (existing.predicate !== draft.predicate) actions.push({ action: "setPredicate", predicate: draft.predicate });
  if (existing.status !== status) actions.push({ action: "setStatus", status });
  if (JSON.stringify(existing.requesters.map((r) => r.associateRole.key)) !== JSON.stringify(["buyer"])) {
    actions.push({ action: "setRequesters", requesters: draft.requesters });
  }
  const approverKeys = existing.approvers.tiers.map((t) => t.and.map((d) => d.or.map((o) => o.associateRole.key)));
  if (JSON.stringify(approverKeys) !== JSON.stringify([[["approver", "admin"]]]))
    actions.push({ action: "setApprovers", approvers: draft.approvers });
  if (actions.length === 0) {
    console.log(`= ${unitKey}: ${draft.name} (${status}) unchanged`);
    return;
  }
  await rules
    .withKey({ key })
    .post({ body: { version: existing.version, actions } })
    .execute();
  console.log(`~ ${unitKey}: ${draft.name}: ${actions.map((a) => a.action).join(", ")}`);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
