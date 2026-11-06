// First URL segments of the (private) root layout, rendered per request. Shared by the proxy and the browser bundle.
export const PRIVATE_SEGMENTS = new Set([
  "account",
  "cart",
  "checkout",
  "order-confirmation",
  "login",
  "logout",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "no-access",
]);
