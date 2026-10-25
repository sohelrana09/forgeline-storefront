import type { AssociateRoleAssignment, AssociateRoleAssignmentDraft, BusinessUnit, BusinessUnitUpdateAction, Order, Permission } from "@commercetools/platform-sdk";
import { apiRoot } from "@/lib/commercetools/client";
import { str } from "@/lib/predicate";
import { staleWhileRevalidate } from "@/lib/memo";
import { forgetBuyingContexts, hasPermissionNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import type { CompanyMember, CompanyRole, CompanyUnit } from "@/features/company/types";

// Company administration (Magento B2B "Company"). The customer token carries no business-unit scope: the only
// ones the storefront client could grant (view/manage_business_units) are project-wide, i.e. every company.
// So reads and writes use the admin client, always for the SELECTED unit only, and every write first checks the
// acting associate's permission live (hasPermissionNow), like quote renegotiation.

export class CompanyError extends Error {}

const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const unit = (ctx: PricingContext) => apiRoot.businessUnits().withKey({ key: ctx.businessUnitKey });

// Associate roles are project-wide and change rarely.
const rolesMemo = staleWhileRevalidate<CompanyRole[]>(5 * 60 * 1000);
export const getRoles = () =>
  rolesMemo("roles", async () => {
    const { body } = await apiRoot.associateRoles().get({ queryArgs: { limit: 100, sort: ["name asc"] } }).execute();
    return body.results.filter((r) => r.buyerAssignable).map((r) => ({ key: r.key, name: r.name ?? r.key, permissions: r.permissions }));
  });

// Fresh roles for decisions (writes, permission checks); getRoles() above is the cached copy for display.
async function liveRoles(): Promise<CompanyRole[]> {
  const { body } = await apiRoot.associateRoles().get({ queryArgs: { limit: 100 } }).execute();
  return body.results.map((r) => ({ key: r.key, name: r.name ?? r.key, permissions: r.buyerAssignable ? r.permissions : [] }));
}

// What a customer may do in this unit right now: roles held directly or inherited, from the unit as just read.
function permissionsIn(bu: BusinessUnit, customerId: string, roles: CompanyRole[]): Set<Permission> | undefined {
  const held = [...bu.associates, ...(bu.inheritedAssociates ?? [])].filter((a) => a.customer.id === customerId);
  if (held.length === 0) return undefined; // not a member (any more)
  const keys = held.flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key));
  return new Set(roles.filter((r) => keys.includes(r.key)).flatMap((r) => r.permissions));
}

const toUnit = (bu: BusinessUnit): CompanyUnit => ({
  key: bu.key,
  name: bu.name,
  unitType: bu.unitType,
  parentKey: bu.parentUnit?.key,
  status: bu.status,
  contactEmail: bu.contactEmail,
});

export async function getCompanyUnit(ctx: PricingContext): Promise<CompanyUnit> {
  return toUnit((await unit(ctx).get().execute()).body);
}

// Members of the selected unit: explicit associates (editable) and inherited ones (read-only). The viewer must
// still be a member (checked on the unit just read, not the 5-minute memo); colleagues' emails are only shown to
// those who manage users (Magento shows the users grid to everyone, contact details to admins).
export async function getCompanyMembers(ctx: PricingContext, viewerId: string): Promise<CompanyMember[]> {
  const [{ body: bu }, roles] = await Promise.all([unit(ctx).get().execute(), liveRoles()]);
  const viewer = permissionsIn(bu, viewerId, roles);
  if (!viewer) throw new CompanyError("You are no longer a user of this company.");
  const showEmails = viewer.has("UpdateAssociates");
  const byCustomer = new Map<string, CompanyMember>();
  const entry = (id: string) => {
    if (!byCustomer.has(id)) byCustomer.set(id, { customerId: id, name: "", email: "", roles: [], inheritedRoles: [], explicit: false });
    return byCustomer.get(id)!;
  };
  for (const a of bu.associates) {
    const m = entry(a.customer.id);
    m.explicit = true;
    m.roles.push(...a.associateRoleAssignments.map((r) => r.associateRole.key));
  }
  for (const a of bu.inheritedAssociates ?? []) entry(a.customer.id).inheritedRoles.push(...a.associateRoleAssignments.map((r) => r.associateRole.key));

  const ids = [...byCustomer.keys()];
  if (ids.length > 0) {
    const { body } = await apiRoot
      .customers()
      .get({ queryArgs: { where: `id in (${ids.map(str).join(", ")})`, limit: ids.length } })
      .execute();
    for (const c of body.results) {
      const m = byCustomer.get(c.id)!;
      m.name = [c.firstName, c.lastName].filter(Boolean).join(" ");
      m.email = showEmails || c.id === viewerId ? c.email : "";
    }
  }
  return [...byCustomer.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}

// The company tree as far as the viewer belongs to it: units they are a member of (live, from the units just
// read) plus those units' parents, so the tree stays connected. Contact emails only for their own units.
export async function getCompanyStructure(ctx: PricingContext, viewerId: string): Promise<(CompanyUnit & { member: boolean })[]> {
  const { body: bu } = await unit(ctx).get().execute();
  const { body } = await apiRoot
    .businessUnits()
    .get({ queryArgs: { where: `topLevelUnit(key=${str(bu.topLevelUnit.key)})`, limit: 100, sort: ["name asc"] } })
    .execute();
  const isMember = (u: BusinessUnit) => [...u.associates, ...(u.inheritedAssociates ?? [])].some((a) => a.customer.id === viewerId);
  const members = body.results.filter(isMember);
  if (!members.some((u) => u.key === ctx.businessUnitKey)) throw new CompanyError("You are no longer a user of this company.");
  const parentOf = new Map(body.results.map((u) => [u.key, u.parentUnit?.key]));
  const withParents = (key: string | undefined): string[] => (key ? [key, ...withParents(parentOf.get(key))] : []);
  const visible = new Set(members.flatMap((u) => withParents(u.key)));
  return body.results
    .filter((u) => visible.has(u.key))
    .map((u) => {
      const member = isMember(u);
      return { ...toUnit(u), contactEmail: member ? u.contactEmail : undefined, member };
    });
}

// All orders of the unit in its store (anyone's), for associates with ViewOthersOrders, checked live.
export async function pageCompanyOrders(ctx: PricingContext, customerId: string, page: number, size: number) {
  if (!(await hasPermissionNow(ctx.businessUnitKey, customerId, "ViewOthersOrders"))) throw new CompanyError("You can't view other people's orders.");
  const { body } = await apiRoot
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .orders()
    .get({
      queryArgs: {
        where: `businessUnit(key=${str(ctx.businessUnitKey)})`,
        sort: ["createdAt desc"],
        limit: size,
        offset: (page - 1) * size,
        withTotal: true,
      },
    })
    .execute();
  return { orders: body.results as Order[], total: body.total ?? body.count };
}

// ---------- Writes ----------
// Every attempt (including the retries after a 409) reads the unit and the roles once and decides on THAT data:
// the actor must hold the permission right now, may only grant roles within their own permissions, and the unit
// must keep at least one user who can manage users.

type Decision = { bu: BusinessUnit; roles: CompanyRole[]; actor: Set<Permission> };

const CAN_MANAGE: Permission = "UpdateAssociates";

async function updateUnit(
  ctx: PricingContext,
  actorId: string,
  permission: "UpdateAssociates" | "UpdateBusinessUnitDetails",
  actions: (d: Decision) => BusinessUnitUpdateAction[],
) {
  for (let attempt = 1; ; attempt++) {
    const [{ body: bu }, roles] = await Promise.all([unit(ctx).get().execute(), liveRoles()]);
    const actor = permissionsIn(bu, actorId, roles);
    if (!actor?.has(permission)) {
      throw new CompanyError(permission === "UpdateAssociates" ? "You can't manage company users." : "You can't edit the company profile.");
    }
    try {
      await unit(ctx).post({ body: { version: bu.version, actions: actions({ bu, roles, actor }) } }).execute();
      break;
    } catch (err) {
      if (statusOf(err) !== 409) throw err;
      if (attempt === 3) throw new CompanyError("Someone else changed this company at the same time. Please reload and try again.");
    }
  }
  forgetBuyingContexts();
}

// Known roles only, and none that would give the user power the admin doesn't have. Own-purchasing permissions
// ("…My…": CreateMyCarts, AcceptMyQuotes, …) only act on the user's own carts, orders and quotes, so they don't
// count: in the sample data the admin role has none of them, and admins must still be able to create buyers.
const ownOnly = (p: Permission) => p.includes("My");

function grantable(keys: string[], { roles, actor }: Decision): string[] {
  const chosen = [...new Set(keys)].map((k) => roles.find((r) => r.key === k && r.permissions.length > 0)).filter((r): r is CompanyRole => !!r);
  if (chosen.length === 0) throw new CompanyError("Choose at least one role.");
  const beyond = chosen.find((r) => r.permissions.some((p) => !ownOnly(p) && !actor.has(p)));
  if (beyond) throw new CompanyError(`You can't give the ${beyond.name} role: it allows more than your own roles do.`);
  return chosen.map((r) => r.key);
}

// After the change, someone (directly or through the parent unit) must still be able to manage users.
function keepsAManager({ bu, roles }: Decision, change: { customerId: string; roles?: string[] }) {
  const managerRoles = new Set(roles.filter((r) => r.permissions.includes(CAN_MANAGE)).map((r) => r.key));
  const explicit = bu.associates.flatMap((a) =>
    a.customer.id === change.customerId ? (change.roles ?? []) : a.associateRoleAssignments.map((r) => r.associateRole.key),
  );
  const inherited = (bu.inheritedAssociates ?? []).flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key));
  if (![...explicit, ...inherited].some((k) => managerRoles.has(k))) {
    throw new CompanyError("The company needs at least one user who can manage users. Give someone else that role first.");
  }
}

export async function updateCompanyProfile(ctx: PricingContext, actorId: string, name: string, contactEmail: string) {
  await updateUnit(ctx, actorId, "UpdateBusinessUnitDetails", () => [
    { action: "changeName", name },
    { action: "setContactEmail", contactEmail: contactEmail || undefined },
  ]);
}

const assignments = (keys: string[], keep: AssociateRoleAssignment[] = []): AssociateRoleAssignmentDraft[] =>
  keys.map((key) => ({
    associateRole: { typeId: "associate-role", key },
    // Keep how an existing role passes to divisions; new roles stay in this unit.
    inheritance: keep.find((a) => a.associateRole.key === key)?.inheritance ?? "Disabled",
  }));

export async function addCompanyUser(ctx: PricingContext, actorId: string, email: string, roleKeys: string[]) {
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `lowercaseEmail=${str(email.toLowerCase())}`, limit: 1 } })
    .execute();
  const customer = body.results[0];
  await updateUnit(ctx, actorId, "UpdateAssociates", (d) => {
    if (d.bu.associateMode === "FromParent") throw new CompanyError("Users of this division come from the parent unit. Add them there.");
    // Checked after the permission, so only user managers learn whether an email has an account.
    if (!customer) throw new CompanyError("There is no customer account with that email. Ask our sales team to create one first.");
    if (d.bu.associates.some((a) => a.customer.id === customer.id)) throw new CompanyError(`${email} is already a user of ${d.bu.name}.`);
    return [
      {
        action: "addAssociate",
        associate: { customer: { typeId: "customer", id: customer.id }, associateRoleAssignments: assignments(grantable(roleKeys, d)) },
      },
    ];
  });
}

// Explicit members only (inherited roles are managed in the parent unit), and never the acting admin themselves,
// so an admin can't lock the company out by mistake.
function editable(bu: BusinessUnit, actorId: string, customerId: string) {
  if (customerId === actorId) throw new CompanyError("You can't change your own roles or remove yourself.");
  const current = bu.associates.find((a) => a.customer.id === customerId);
  if (!current) throw new CompanyError("This user's roles come from the parent unit. Change them there.");
  return current;
}

export async function changeCompanyUserRoles(ctx: PricingContext, actorId: string, customerId: string, roleKeys: string[]) {
  await updateUnit(ctx, actorId, "UpdateAssociates", (d) => {
    const current = editable(d.bu, actorId, customerId);
    // Nor take away a role the admin couldn't give: someone with more rights is left as they are.
    grantable(current.associateRoleAssignments.map((r) => r.associateRole.key ?? ""), d);
    const keys = grantable(roleKeys, d);
    keepsAManager(d, { customerId, roles: keys });
    return [
      {
        action: "changeAssociate",
        associate: { customer: { typeId: "customer", id: customerId }, associateRoleAssignments: assignments(keys, current.associateRoleAssignments) },
      },
    ];
  });
}

export async function removeCompanyUser(ctx: PricingContext, actorId: string, customerId: string) {
  await updateUnit(ctx, actorId, "UpdateAssociates", (d) => {
    const current = editable(d.bu, actorId, customerId);
    grantable(current.associateRoleAssignments.map((r) => r.associateRole.key ?? ""), d);
    keepsAManager(d, { customerId });
    return [{ action: "removeAssociate", customer: { typeId: "customer", id: customerId } }];
  });
}

// A colleague's order in the unit (order view), for associates with ViewOthersOrders, checked live.
export async function getCompanyOrder(ctx: PricingContext, customerId: string, orderId: string): Promise<Order | undefined> {
  if (!(await hasPermissionNow(ctx.businessUnitKey, customerId, "ViewOthersOrders"))) return undefined;
  const order = await apiRoot
    .inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey })
    .orders()
    .withId({ ID: orderId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => {
      if (statusOf(err) === 404) return undefined;
      throw err;
    });
  return order?.businessUnit?.key === ctx.businessUnitKey ? order : undefined;
}
