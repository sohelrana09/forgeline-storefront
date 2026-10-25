// Session cookie + customer-token helpers for the signed-in buyer (server-only).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { projectKey } from "@/lib/commercetools/client";
import { refreshAnonymousToken, type AnonymousToken } from "@/lib/commercetools/customer-token";
import { GUEST_STORE_KEY, getBuyingContexts } from "@/features/business-units/service";

// The browser never sees the customer token: the session cookie is AES-256-GCM encrypted with a key derived
// from the (server-only) admin client secret. The token itself only carries customerScopes() below.
export const SESSION_COOKIE = "ct_session";
export const BU_COOKIE = "ct_bu";
export const cartCookie = (businessUnitKey: string) => `ct_cart_${businessUnitKey}`;
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

// `name` is the first name at sign-in, for the header greeting (older sessions may not have it).
export type Session = { accessToken: string; expiresAt: number; customerId: string; email: string; name?: string };

// Sealed cookies use their cookie name as AAD, so a guest cookie can never be replayed as a session (or back).
function key() {
  const secret = process.env.CTP_CLIENT_SECRET;
  if (!secret) throw new Error("CTP_CLIENT_SECRET is required to encrypt sessions");
  return Buffer.from(hkdfSync("sha256", secret, "ct-storefront", "session-cookie-v1", 32));
}

function seal(name: string, value: object): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(name));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function unseal<T>(name: string, value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    const [iv, tag, data] = value.split(".").map((p) => Buffer.from(p, "base64url"));
    // Fixed lengths: never let a cookie choose a shorter (cheaper to forge) GCM tag.
    if (iv?.length !== 12 || tag?.length !== 16 || !data) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
    decipher.setAAD(Buffer.from(name));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as T;
  } catch {
    return undefined; // tampered or from an old key
  }
}

export const sealSession = (session: Session) => seal(SESSION_COOKIE, session);

// Writes the session cookie; it expires with the token. Server Actions and Route Handlers only.
export async function saveSession(session: Session) {
  (await cookies()).set(SESSION_COOKIE, sealSession(session), {
    ...cookieOptions,
    maxAge: Math.floor((session.expiresAt - Date.now()) / 1000),
  });
}

export async function getSession(): Promise<Session | undefined> {
  const session = unseal<Session>(SESSION_COOKIE, (await cookies()).get(SESSION_COOKIE)?.value);
  // Tokens last 48h; after that the buyer signs in again (refresh-token flow is a follow-up).
  return session && session.expiresAt > Date.now() + 60_000 ? session : undefined;
}

// Guest browsing: an anonymous token (created on the first "Add to cart", not per visit) and the guest cart.
export type GuestSession = AnonymousToken & { cartId?: string };
export const GUEST_COOKIE = "ct_guest";

// The refresh token lives as long as the guest cart, so the cookie keeps it (sealed) for the full 30 days.
export async function saveGuest(guest: GuestSession) {
  (await cookies()).set(GUEST_COOKIE, seal(GUEST_COOKIE, guest), cookieOptions);
}

// Refreshes an expired access token. Server Components can't write cookies, so there the new token is only
// used for this request, and the next Server Action (add to cart, sign-in) stores it.
export async function getGuest(): Promise<GuestSession | undefined> {
  const guest = unseal<GuestSession>(GUEST_COOKIE, (await cookies()).get(GUEST_COOKIE)?.value);
  if (!guest || guest.expiresAt > Date.now() + 60_000) return guest;
  const fresh = await refreshAnonymousToken(guest);
  if (!fresh) return undefined;
  const refreshed = { ...guest, ...fresh };
  await saveGuest(refreshed).catch(() => {});
  return refreshed;
}

// Guests only see their own carts in the guest store.
export const guestScopes = (storeKey: string) => [`manage_my_orders:${projectKey}:${storeKey}`];

// Least privilege for the customer token: their own profile, plus "my carts/orders" in the stores the
// storefront sells from. No project-wide scopes, so admin endpoints answer 403 for this token.
export async function customerScopes(): Promise<string[]> {
  // The units' stores, plus the B2C store for customers without a company (consumers).
  const stores = [...new Set([...(await getBuyingContexts()).map((c) => c.storeKey), GUEST_STORE_KEY])];
  return [
    `manage_my_profile:${projectKey}`,
    ...stores.map((s) => `manage_my_orders:${projectKey}:${s}`),
    // Purchase lists (shopping lists) are per store too; the project-wide variant is refused.
    ...stores.map((s) => `manage_my_shopping_lists:${projectKey}:${s}`),
    // Quotes have no per-store "me" endpoints, so these are project-wide; "my" still means only the buyer's own.
    `manage_my_quote_requests:${projectKey}`,
    `manage_my_quotes:${projectKey}`,
  ];
}

// A revoked/expired customer token: clear the session in the /logout Route Handler (Server Components can't
// delete cookies, and redirecting to /login directly would loop back to / while the cookie still decrypts).
// A 403 "insufficient_scope" means the session predates a scope the storefront now needs: sign in again.
export function signOutOnAuthError(err: unknown): never {
  const body = (err as { body?: { statusCode?: number; errors?: { code?: string }[] } })?.body;
  if (body?.statusCode === 401) redirect("/logout");
  if (body?.statusCode === 403 && body.errors?.some((e) => e.code === "insufficient_scope")) redirect("/logout");
  throw err;
}
