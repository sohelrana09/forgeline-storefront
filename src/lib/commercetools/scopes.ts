// What the running storefront may do with its API client (CTP_CLIENT_*), and nothing more. A leaked token, or a bug
// that lets someone steer a server request, then can't touch products, prices, discounts, API clients or project
// settings. Set CTP_SCOPES to this list (npm run setup does), and for full effect create the client in Merchant Center
// with exactly these scopes. Scripts that change the catalog (npm run setup, ct:*) use their own client instead:
// CTP_ADMIN_CLIENT_* (src/lib/commercetools/client.ts), kept out of the hosting.
// Pure (no imports), so the setup script and the tests read the same list.
export const RUNTIME_SCOPES = [
  // Catalog: products with price selection, categories, stores and their channels, delivery methods.
  "view_published_products",
  "view_standalone_prices",
  "view_categories",
  "view_stores",
  "view_shipping_methods",
  // Companies: units, roles, users (company area, invitations), sign-up email confirmation and password reset.
  "view_associate_roles",
  "manage_business_units",
  "manage_customers",
  // Orders, quotes, approvals and company purchase lists, always for one unit after a live permission check.
  "manage_orders",
  "manage_quotes",
  "manage_approval_flows",
  "manage_approval_rules",
  "manage_shopping_lists",
  // Invitations, session revocation marks, merchants' redirects (Custom Objects).
  "manage_key_value_documents",
  // Card payments: commercetools Checkout sessions (checkout-session.ts narrows its own token further).
  "manage_sessions",
  // Payments for invoice and bank-transfer orders (features/order-processing), and reading how an order was paid.
  "manage_payments",
  // Giving stock back after a cancelled order (features/order-processing): commercetools has no narrower scope for
  // inventory, and this one also covers products. Leave it out, with RESTOCK_ON_CANCEL=false, when an ERP owns stock.
  "manage_products",
] as const;

// Scopes only an optional feature (docs/features/) needs, by the env flag that switches it on. A feature that is off
// asks for nothing, so a shop without it keeps the narrower client.
export const FEATURE_SCOPES: Record<string, readonly string[]> = {
  // Native commercetools Recurring Orders and the recurrence policies they follow (features/recurring-orders).
  RECURRING_ORDERS: ["manage_recurring_orders", "view_recurrence_policies"],
  // Product reviews: verified buyers write them, approved ones show on the product page (features/reviews).
  REVIEWS: ["manage_reviews", "view_states"],
};

// RUNTIME_SCOPES plus those of every feature switched on in `env` ("true").
export function requiredScopes(env: Record<string, string | undefined>): string[] {
  const extra = Object.entries(FEATURE_SCOPES).flatMap(([flag, scopes]) => (env[flag] === "true" ? scopes : []));
  return [...new Set([...RUNTIME_SCOPES, ...extra])];
}

export const runtimeScopes = (projectKey: string, env: Record<string, string | undefined> = {}) =>
  requiredScopes(env)
    .map((s) => `${s}:${projectKey}`)
    .join(" ");

// A client's scopes (as a token lists them, without ":<project>") against RUNTIME_SCOPES. A Manage scope covers its
// View scope, and view_products (published and staged) covers view_published_products. `missing`: what the shop
// would be refused; `extra`: rights it doesn't need (each one widens what a leak can do).
export function compareScopes(granted: string[], required: readonly string[] = RUNTIME_SCOPES): { missing: string[]; extra: string[] } {
  const has = new Set(granted);
  const covers = (s: string) =>
    has.has(s) ||
    (s.startsWith("view_") && has.has(s.replace("view_", "manage_"))) ||
    (s === "view_published_products" && has.has("view_products"));
  const allowed = new Set<string>([...required, "view_products"]);
  for (const s of required) if (s.startsWith("manage_")) allowed.add(s.replace("manage_", "view_"));
  return { missing: required.filter((s) => !covers(s)), extra: granted.filter((s) => !allowed.has(s)).sort() };
}
