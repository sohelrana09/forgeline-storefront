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
] as const;

export const runtimeScopes = (projectKey: string) => RUNTIME_SCOPES.map((s) => `${s}:${projectKey}`).join(" ");
