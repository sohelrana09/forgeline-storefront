import "server-only";
import { projectKey, requireEnv } from "@/lib/commercetools/client";

// Customer logins use the storefront API client (only manage_my_* style scopes), never the admin client:
// a password-flow token inherits every scope of the client that requested it.
const storefrontAuth = () =>
  `Basic ${Buffer.from(`${requireEnv("CTP_STOREFRONT_CLIENT_ID")}:${requireEnv("CTP_STOREFRONT_CLIENT_SECRET")}`).toString("base64")}`;

export type TokenResult = { ok: true; accessToken: string; expiresAt: number } | { ok: false; reason: "credentials" | "unavailable" };

// Customer password flow: exchanges email + password for a customer-bound token limited to `scopes`.
// Always pass an explicit list: without one the token inherits every scope of the storefront client.
export async function requestCustomerToken(email: string, password: string, scopes: string[]): Promise<TokenResult> {
  let authorization: string;
  try {
    authorization = storefrontAuth();
  } catch (err) {
    console.error("customer login is not configured:", (err as Error).message);
    return { ok: false, reason: "unavailable" };
  }
  const res = await fetch(`${requireEnv("CTP_AUTH_URL")}/oauth/${projectKey}/customers/token`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", username: email, password, scope: scopes.join(" ") }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (res.ok && body.access_token && body.expires_in) {
    return { ok: true, accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  }
  if (res.status === 400 && body.error === "invalid_customer_account_credentials") return { ok: false, reason: "credentials" };
  // Misconfigured client, scopes or an outage: log it, don't disguise it as a wrong password.
  console.error("customer token request failed", res.status, body.error);
  return { ok: false, reason: "unavailable" };
}

// Best effort: a logged-out token should stop working immediately, not after 48h.
export async function revokeToken(token: string, hint: "access_token" | "refresh_token" = "access_token") {
  try {
    await fetch(`${requireEnv("CTP_AUTH_URL")}/oauth/token/revoke`, {
      method: "POST",
      headers: { Authorization: storefrontAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, token_type_hint: hint }),
    });
  } catch {
    // Sign-out must never fail; the cookie is deleted either way.
  }
}

export type AnonymousToken = { accessToken: string; refreshToken: string; expiresAt: number; anonymousId: string };

type TokenBody = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };

async function tokenRequest(path: string, params: Record<string, string>): Promise<TokenBody | undefined> {
  // Guest pages call this while rendering: an auth outage means "no guest token", never a crashed page.
  const res = await fetch(`${requireEnv("CTP_AUTH_URL")}${path}`, {
    method: "POST",
    headers: { Authorization: storefrontAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }).catch((err) => {
    console.error("token request failed", path, (err as Error).message);
    return undefined;
  });
  if (!res) return undefined;
  const body = (await res.json().catch(() => ({}))) as TokenBody;
  if (res.ok && body.access_token && body.expires_in) return body;
  console.error("token request failed", path, res.status, body.error);
  return undefined;
}

// Guest (anonymous) session: commercetools generates an anonymous_id and only lets the token see that
// guest's own carts in the stores of `scopes`. Lasts 3h; the refresh token keeps the same anonymous_id.
export async function requestAnonymousToken(scopes: string[]): Promise<AnonymousToken | undefined> {
  const body = await tokenRequest(`/oauth/${projectKey}/anonymous/token`, {
    grant_type: "client_credentials",
    scope: scopes.join(" "),
  });
  const anonymousId = body?.scope?.match(/(?:^| )anonymous_id:(\S+)/)?.[1];
  if (!body?.access_token || !body.refresh_token || !anonymousId) return undefined;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in! * 1000,
    anonymousId,
  };
}

// A new access token for the same guest (undefined when the refresh token was revoked or expired).
export async function refreshAnonymousToken(token: AnonymousToken): Promise<AnonymousToken | undefined> {
  const body = await tokenRequest("/oauth/token", { grant_type: "refresh_token", refresh_token: token.refreshToken });
  return body?.access_token ? { ...token, accessToken: body.access_token, expiresAt: Date.now() + body.expires_in! * 1000 } : undefined;
}

export type SignUpDraft = { email: string; password: string; firstName: string; lastName: string };
export type SignUpResult = { ok: true; customerId: string } | { ok: false; reason: "exists" | "unavailable" };

// Self-service sign-up (/me/signup) with a storefront client token limited to manage_my_profile: the token can
// create this one customer, nothing else. No admin client involved.
export async function signUpCustomer(draft: SignUpDraft): Promise<SignUpResult> {
  const token = await tokenRequest("/oauth/token", {
    grant_type: "client_credentials",
    scope: `manage_my_profile:${projectKey}`,
  });
  if (!token?.access_token) return { ok: false, reason: "unavailable" };
  const res = await fetch(`${requireEnv("CTP_API_URL")}/${projectKey}/me/signup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  }).catch(() => undefined);
  const body = (await res?.json().catch(() => ({}))) as {
    customer?: { id: string };
    errors?: { code?: string; field?: string }[];
  };
  if (res?.ok && body.customer) return { ok: true, customerId: body.customer.id };
  if (body.errors?.some((e) => e.code === "DuplicateField" && e.field === "email")) return { ok: false, reason: "exists" };
  console.error(
    "sign-up failed",
    res?.status,
    body.errors?.map((e) => e.code),
  );
  return { ok: false, reason: "unavailable" };
}
