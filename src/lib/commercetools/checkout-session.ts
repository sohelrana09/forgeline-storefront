import "server-only";
import { projectKey, requireEnv } from "@/lib/commercetools/client";
import { B2C_STORE_KEY } from "@/lib/commercetools/stores";

// commercetools Checkout (Payment Only mode): the server creates a Checkout Session for a cart; the browser SDK
// (@commercetools/checkout-browser-sdk, paymentFlow) shows the payment methods of the Application configured in
// Merchant Center, takes the payment through its Connector and creates the Order.
// The session token comes from the admin client but is narrowed to what the docs list for creating sessions:
// manage_sessions plus manage_orders (here only for the B2C store). Checkout creates the Payment and the Order
// with its own permissions (confirmed in Merchant Center when Checkout is set up), not with this token.

// e.g. https://api.us-east-2.aws.commercetools.com → us-east-2.aws (the SDK's `region`, the Session API host).
export const checkoutRegion = () => new URL(requireEnv("CTP_API_URL")).hostname.replace(/^api\./, "").replace(/\.commercetools\.com$/, "");

// Card payments for consumers and guests are switched on with B2C_CARD_PAYMENTS=true. Off (the default), B2C orders
// are placed directly and paid by bank transfer: the fallback while Checkout isn't set up (see docs/checkout-setup.md).
export const cardPaymentsEnabled = () => process.env.B2C_CARD_PAYMENTS === "true";

// The Payment Only Application's key from Merchant Center (Checkout → Applications).
export const checkoutApplicationKey = () => process.env.CTP_CHECKOUT_APPLICATION_KEY || "ironline-payment";

let cached: { token: string; expiresAt: number } | undefined;

// Orders limited to the B2C store when the client was created with that store scope; commercetools grants only scopes
// a client holds by name, so a client with project-wide manage_orders (RUNTIME_SCOPES) gets that one instead.
const sessionScopes = () => [
  `manage_sessions:${projectKey} manage_orders:${projectKey}:${B2C_STORE_KEY}`,
  `manage_sessions:${projectKey} manage_orders:${projectKey}`,
];

async function sessionToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const basic = Buffer.from(`${requireEnv("CTP_CLIENT_ID")}:${requireEnv("CTP_CLIENT_SECRET")}`).toString("base64");
  let failure = "";
  for (const scope of sessionScopes()) {
    const res = await fetch(`${requireEnv("CTP_AUTH_URL")}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", scope }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (res.ok && body.access_token && body.expires_in) {
      cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
      return cached.token;
    }
    failure = `${res.status} ${body.error ?? ""}`;
    if (body.error !== "invalid_scope") break;
  }
  throw new Error(`checkout token failed: ${failure}`);
}

export type CheckoutSession = { sessionId: string; projectKey: string; region: string };

// Call only for a cart the caller has just proven to own (read with their own token).
export async function createCheckoutSession(cartId: string): Promise<CheckoutSession> {
  const region = checkoutRegion();
  const res = await fetch(`https://session.${region}.commercetools.com/${projectKey}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await sessionToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cart: { cartRef: { id: cartId } }, metadata: { applicationKey: checkoutApplicationKey() } }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`checkout session failed: ${res.status} ${body.message ?? ""}`);
  return { sessionId: body.id, projectKey, region };
}
