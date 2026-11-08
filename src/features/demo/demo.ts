// Demo personas (docs/features/demo-personas.md), pure and unit-tested. Behind DEMO_MODE only: visitors try the store
// as the demo company's buyer, approver or admin without a password of their own; the server signs them in with
// DEMO_PASSWORD, which never reaches the browser. A nightly reset puts the personas' carts, quotes, approvals, lists,
// budgets and recurring orders back. Without DEMO_MODE none of this runs and nothing is shown.

type Env = Record<string, string | undefined>;

export const DEMO_ROLES = ["buyer", "approver", "admin"] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_LABELS: Record<DemoRole, { label: string; blurb: string }> = {
  buyer: { label: "Buyer", blurb: "Orders, quotes, purchase lists and recurring orders" },
  approver: { label: "Approver", blurb: "Approves or rejects orders over the company's limit" },
  admin: { label: "Admin", blurb: "Company users, roles, budgets and approval rules" },
};

// The sample data's demo company (LiftTech Soluciones S.L.), as in e2e/signed-in/accounts.ts; another project sets its own.
const DEFAULT_EMAILS: Record<DemoRole, string> = {
  buyer: "sofia-lopez@ltsl.com",
  approver: "carlos-garcia@ltsl.com",
  admin: "oliver-smith@ltsl.com",
};

export const demoEnabled = (env: Env = process.env) => env.DEMO_MODE === "true";
// The switcher works only with a password to sign in with.
export const demoSignInEnabled = (env: Env = process.env) => demoEnabled(env) && Boolean(env.DEMO_PASSWORD);

export function demoEmails(env: Env = process.env): Record<DemoRole, string> {
  const pick = (role: DemoRole) => (env[`DEMO_${role.toUpperCase()}_EMAIL`] ?? DEFAULT_EMAILS[role]).trim().toLowerCase();
  return { buyer: pick("buyer"), approver: pick("approver"), admin: pick("admin") };
}

export const isDemoRole = (value: unknown): value is DemoRole => DEMO_ROLES.includes(value as DemoRole);

// Is this account one of the shared personas? Only while DEMO_MODE is on.
export function isDemoAccount(email: string | undefined, env: Env = process.env): boolean {
  if (!email || !demoEnabled(env)) return false;
  return Object.values(demoEmails(env)).includes(email.trim().toLowerCase());
}

export const DEMO_LOCKED = "This is a shared demo account, so this change is turned off. Everything else works and resets every night.";

// For actions that would lock other visitors out of a persona or change who the personas are (password, company users,
// roles, approval rules, invitations): the message to show, or undefined when the change may go ahead.
export const demoLocked = (email: string | undefined, env: Env = process.env) => (isDemoAccount(email, env) ? DEMO_LOCKED : undefined);

// ---------------------------------------------------------------------------------------------------------------
// Nightly reset plan. The service reads what the personas created; this decides what to do with it, so the rules are
// testable without the API. Orders stay (they are the demo's history); pending approvals are rejected, which cancels
// their orders the same way an approver's rejection does.

export type Ref = { id: string; version: number };
export type ResetInput = {
  carts: Ref[];
  quotes: Ref[];
  stagedQuotes: Ref[];
  quoteRequests: Ref[];
  shoppingLists: Ref[];
  recurringOrders: Ref[];
  // Approval flows still pending in the personas' units.
  pendingApprovals: (Ref & { unitKey: string })[];
  budgets: { key: string; version: number }[];
};

export type ResetStep =
  | { kind: "reject-approval"; id: string; version: number; unitKey: string }
  | {
      kind: "delete";
      resource: "quote" | "staged-quote" | "quote-request" | "cart" | "shopping-list" | "recurring-order";
      id: string;
      version: number;
    }
  | { kind: "delete-budget"; key: string };

// Order matters: approvals first (their orders get cancelled while the flow still exists); quotes before the staged
// quotes and requests they come from; recurring orders before the carts they were made from.
export function planReset(input: ResetInput): ResetStep[] {
  const del = (resource: Extract<ResetStep, { kind: "delete" }>["resource"], refs: Ref[]): ResetStep[] =>
    refs.map(({ id, version }) => ({ kind: "delete", resource, id, version }));
  return [
    ...input.pendingApprovals.map(({ id, version, unitKey }): ResetStep => ({ kind: "reject-approval", id, version, unitKey })),
    ...del("quote", input.quotes),
    ...del("staged-quote", input.stagedQuotes),
    ...del("quote-request", input.quoteRequests),
    ...del("recurring-order", input.recurringOrders),
    ...del("cart", input.carts),
    ...del("shopping-list", input.shoppingLists),
    ...input.budgets.map(({ key }): ResetStep => ({ kind: "delete-budget", key })),
  ];
}

export function summarizePlan(steps: ResetStep[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of steps) {
    const name = s.kind === "delete" ? s.resource : s.kind;
    out[name] = (out[name] ?? 0) + 1;
  }
  return out;
}
