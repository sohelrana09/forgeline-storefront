import "server-only";
import type { ApprovalRule, ApprovalRuleUpdateAction, Permission } from "@commercetools/platform-sdk";
import { apiRoot, asAssociate } from "@/lib/commercetools/client";
import { formatMoney } from "@/lib/utils";
import { str } from "@/lib/predicate";
import { hasPermissionNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import { CompanyError } from "@/features/company/service";
import { UUID } from "@/features/orders/utils";
import type { ApprovalRuleInput, ApprovalRuleSummary } from "@/features/company/types";

// Approval rules of the selected unit. commercetools only reaches them "as associate",
// so the admin client acts with the signed-in user's id after a live permission check; commercetools then checks
// CreateApprovalRules / UpdateApprovalRules itself too. The condition is built here from a validated amount in the
// unit's currency: users never type predicate syntax. Rules can't be deleted, only switched off (Inactive).

const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const rules = (ctx: PricingContext, actorId: string) => asAssociate(actorId, ctx.businessUnitKey).approvalRules();

// "Order total above X": the only condition the form builds. Other predicates (made elsewhere) are shown as is.
const TOTAL = /^totalPrice\.centAmount > (\d+) and totalPrice\.currencyCode = "([A-Z]{3})"$/;
export const totalPredicate = (amount: number, currency: string) =>
  `totalPrice.centAmount > ${Math.round(amount * 100)} and totalPrice.currencyCode = "${currency}"`;

function summarize(rule: ApprovalRule): ApprovalRuleSummary {
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

async function requirePermission(ctx: PricingContext, actorId: string, permissions: Permission[]) {
  for (const p of permissions) if (await hasPermissionNow(ctx.businessUnitKey, actorId, p)) return;
  throw new CompanyError("You can't manage approval rules for this company.");
}

export async function listApprovalRules(ctx: PricingContext, actorId: string): Promise<ApprovalRuleSummary[]> {
  await requirePermission(ctx, actorId, ["CreateApprovalRules", "UpdateApprovalRules"]);
  const { body } = await rules(ctx, actorId)
    .get({ queryArgs: { limit: 100, sort: ["createdAt desc"] } })
    .execute();
  return body.results.map(summarize);
}

export async function getApprovalRule(ctx: PricingContext, actorId: string, id: string): Promise<ApprovalRuleSummary | undefined> {
  if (!UUID.test(id)) return undefined;
  await requirePermission(ctx, actorId, ["UpdateApprovalRules"]);
  const rule = await rules(ctx, actorId)
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  return rule && summarize(rule);
}

// Requester and approver roles must be existing, buyer-assignable roles; approvers need UpdateApprovalFlows, and
// someone in the unit (directly or inherited) must hold one of them: a rule nobody can approve would block every
// matching order.
async function checkRoles(ctx: PricingContext, requesters: string[], approvers: string[]) {
  const keys = [...new Set([...requesters, ...approvers])];
  if (requesters.length === 0) throw new CompanyError("Choose whose orders the rule applies to.");
  if (approvers.length === 0) throw new CompanyError("Choose who can approve the orders.");
  const [{ body: found }, { body: bu }] = await Promise.all([
    apiRoot
      .associateRoles()
      .get({ queryArgs: { where: `key in (${keys.map(str).join(", ")})`, limit: 50 } })
      .execute(),
    apiRoot.businessUnits().withKey({ key: ctx.businessUnitKey }).get().execute(),
  ]);
  const known = found.results.filter((r) => r.buyerAssignable);
  if (requesters.some((k) => !known.some((r) => r.key === k))) throw new CompanyError("Choose whose orders the rule applies to.");
  if (approvers.some((k) => !known.some((r) => r.key === k && r.permissions.includes("UpdateApprovalFlows")))) {
    throw new CompanyError("Choose approver roles that are allowed to approve orders.");
  }
  const held = [...bu.associates, ...(bu.inheritedAssociates ?? [])].flatMap((a) =>
    a.associateRoleAssignments.map((r) => r.associateRole.key),
  );
  if (!approvers.some((k) => held.includes(k))) {
    throw new CompanyError("Nobody in this company holds an approver role you chose, so matching orders could never be approved.");
  }
}

const role = (key: string) => ({ associateRole: { typeId: "associate-role" as const, key } });
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((k) => b.includes(k));

export async function saveApprovalRule(ctx: PricingContext, actorId: string, input: ApprovalRuleInput): Promise<string> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new CompanyError("Enter the order total as a whole amount.");
  const predicate = totalPredicate(input.amount, ctx.currency);
  const approvers = { tiers: [{ and: [{ or: input.approvers.map(role) }] }] };
  const requesters = input.requesters.map(role);
  const status = input.active ? "Active" : "Inactive";

  if (!input.id) {
    await requirePermission(ctx, actorId, ["CreateApprovalRules"]);
    await checkRoles(ctx, input.requesters, input.approvers);
    const { body } = await rules(ctx, actorId)
      .post({
        body: {
          name: input.name,
          description: input.description || undefined,
          status,
          predicate,
          approvers,
          requesters,
        },
      })
      .execute();
    return body.id;
  }

  await requirePermission(ctx, actorId, ["UpdateApprovalRules"]);
  const current = await rules(ctx, actorId)
    .withId({ ID: input.id })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (!current) throw new CompanyError("This rule no longer exists.");
  // The form only represents "order total above" rules with one approval step; never overwrite others with it.
  if (!TOTAL.test(current.predicate) || current.approvers.tiers.length !== 1) throw new CompanyError("This rule can't be edited here.");
  if (current.version !== input.version) throw new CompanyError("Someone else changed this rule. Please reload it and try again.");

  const currentApprovers = summarize(current).approvers;
  const currentRequesters = current.requesters.map((r) => r.associateRole.key);
  const rolesChanged = !sameSet(currentApprovers, input.approvers) || !sameSet(currentRequesters, input.requesters);
  // Switching a rule off or renaming it must work even if its roles have changed since.
  if (rolesChanged) await checkRoles(ctx, input.requesters, input.approvers);
  const actions: ApprovalRuleUpdateAction[] = [];
  if (current.name !== input.name) actions.push({ action: "setName", name: input.name });
  if ((current.description ?? "") !== input.description)
    actions.push({ action: "setDescription", description: input.description || undefined });
  if (current.status !== status) actions.push({ action: "setStatus", status });
  if (current.predicate !== predicate) actions.push({ action: "setPredicate", predicate });
  if (!sameSet(currentApprovers, input.approvers)) actions.push({ action: "setApprovers", approvers });
  if (!sameSet(currentRequesters, input.requesters)) actions.push({ action: "setRequesters", requesters });
  if (actions.length > 0) {
    try {
      await rules(ctx, actorId)
        .withId({ ID: input.id })
        .post({ body: { version: current.version, actions } })
        .execute();
    } catch (err) {
      if (statusOf(err) === 409) throw new CompanyError("Someone else changed this rule. Please reload it and try again.");
      throw err;
    }
  }
  return input.id;
}
