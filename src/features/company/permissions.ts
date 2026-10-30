import type { AssociateRole, BusinessUnit, Permission } from "@commercetools/platform-sdk";
import type { CompanyRole } from "@/features/company/types";

// The company area's permission decisions, on data the service has just read (pure, unit-tested). The service reads
// the unit and the roles live, then asks these functions who may do what; nothing here calls commercetools.

export class CompanyError extends Error {
  // "forbidden": the acting associate lacks the permission or tried to give more than they hold.
  constructor(
    message: string,
    readonly reason?: "forbidden",
  ) {
    super(message);
  }
}

// Roles as decisions see them: roles our team sets (not buyer-assignable) grant nothing a company admin may hand out.
export const toCompanyRoles = (roles: AssociateRole[]): CompanyRole[] =>
  roles.map((r) => ({ key: r.key, name: r.name ?? r.key, permissions: r.buyerAssignable ? r.permissions : [] }));

// What a customer may do in this unit right now: roles held directly or inherited, from the unit as just read.
export function permissionsIn(bu: BusinessUnit, customerId: string, roles: CompanyRole[]): Set<Permission> | undefined {
  const held = [...bu.associates, ...(bu.inheritedAssociates ?? [])].filter((a) => a.customer.id === customerId);
  if (held.length === 0) return undefined; // not a member (any more)
  const keys = held.flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key));
  return new Set(roles.filter((r) => keys.includes(r.key)).flatMap((r) => r.permissions));
}

// Colleagues' emails are only for those who manage users; everyone sees their own.
export const visibleEmail = (viewer: Set<Permission>, viewerId: string, customer: { id: string; email: string }) =>
  viewer.has("UpdateAssociates") || customer.id === viewerId ? customer.email : "";

export type Decision = { bu: BusinessUnit; roles: CompanyRole[]; actor: Set<Permission> };

const CAN_MANAGE: Permission = "UpdateAssociates";

// Known roles only, and none that would give the user power the admin doesn't have. Own-purchasing permissions
// ("…My…": CreateMyCarts, AcceptMyQuotes, …) only act on the user's own carts, orders and quotes, so they don't
// count: in the sample data the admin role has none of them, and admins must still be able to create buyers.
const ownOnly = (p: Permission) => p.includes("My");

export function grantable(keys: string[], { roles, actor }: Pick<Decision, "roles" | "actor">): string[] {
  const chosen = [...new Set(keys)]
    .map((k) => roles.find((r) => r.key === k && r.permissions.length > 0))
    .filter((r): r is CompanyRole => !!r);
  if (chosen.length === 0) throw new CompanyError("Choose at least one role.");
  const beyond = chosen.find((r) => r.permissions.some((p) => !ownOnly(p) && !actor.has(p)));
  if (beyond) throw new CompanyError(`You can't give the ${beyond.name} role: it allows more than your own roles do.`, "forbidden");
  return chosen.map((r) => r.key);
}

// After the change, someone (directly or through the parent unit) must still be able to manage users.
export function keepsAManager({ bu, roles }: Pick<Decision, "bu" | "roles">, change: { customerId: string; roles?: string[] }) {
  const managerRoles = new Set(roles.filter((r) => r.permissions.includes(CAN_MANAGE)).map((r) => r.key));
  const explicit = bu.associates.flatMap((a) =>
    a.customer.id === change.customerId ? (change.roles ?? []) : a.associateRoleAssignments.map((r) => r.associateRole.key),
  );
  const inherited = (bu.inheritedAssociates ?? []).flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key));
  if (![...explicit, ...inherited].some((k) => managerRoles.has(k))) {
    throw new CompanyError("The company needs at least one user who can manage users. Give someone else that role first.");
  }
}

// Explicit members only (inherited roles are managed in the parent unit), and never the acting admin themselves,
// so an admin can't lock the company out by mistake.
// Also never someone holding a role the company can't assign (set by our team): changing or removing them would
// silently drop that role, which the admin couldn't give back.
export function editable({ bu, roles }: Pick<Decision, "bu" | "roles">, actorId: string, customerId: string) {
  if (customerId === actorId) throw new CompanyError("You can't change your own roles or remove yourself.");
  const current = bu.associates.find((a) => a.customer.id === customerId);
  if (!current) throw new CompanyError("This user's roles come from the parent unit. Change them there.");
  const sellerRole = current.associateRoleAssignments.find(
    (a) => !roles.some((r) => r.key === a.associateRole.key && r.permissions.length > 0),
  );
  if (sellerRole) throw new CompanyError("This user has a role set by our team. Contact us to change or remove them.");
  return current;
}
