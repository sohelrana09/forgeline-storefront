// Pages of features that are switched off by an environment flag. The proxy answers them with a real 404 before
// anything streams: a page's own notFound() comes after its layout has started the response, so it would show the
// not-found page with status 200. Keep in step with each feature's `…Enabled()` helper (same variable, "true" = on).
const GATED: { prefix: string; flag: string }[] = [
  { prefix: "/punchout", flag: "PUNCHOUT" },
  { prefix: "/account/recurring-orders", flag: "RECURRING_ORDERS" },
  { prefix: "/account/shared-carts", flag: "SHARED_CARTS" },
  { prefix: "/account/company/budgets", flag: "SPENDING_LIMITS" },
];

export function isDisabledFeaturePath(pathname: string, env: Record<string, string | undefined> = process.env): boolean {
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return GATED.some(({ prefix, flag }) => (path === prefix || path.startsWith(`${prefix}/`)) && env[flag] !== "true");
}
