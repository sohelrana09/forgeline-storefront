// Session cookie + customer-token helpers for the signed-in buyer (server-only).
import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { customerApiRoot, projectKey } from "@/lib/commercetools/client";
import { refreshAnonymousToken, refreshCustomerToken, revokeToken, type AnonymousToken } from "@/lib/commercetools/customer-token";
import { GUEST_STORE_KEY, getBuyingContexts } from "@/features/business-units/service";
import { rememberAccount } from "@/features/auth/utils";
import { sessionsValidAfter } from "@/features/auth/revocation";

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

// `name` is the first name at sign-in, for the header greeting (older sessions may not have it). `issuedAt` (sign-in
// time) is checked against a password reset (./revocation); older sessions count from their token's start.
// `refreshToken` renews the 48 h access token, so a session lasts as long as its cookie (30 days since the last save).
export type Session = {
  accessToken: string;
  expiresAt: number;
  customerId: string;
  email: string;
  name?: string;
  issuedAt?: number;
  refreshToken?: string;
};
const TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000;

// Cookie keys. SESSION_SECRET seals new cookies; SESSION_SECRET_PREVIOUS (during a rotation) still opens the ones it
// sealed, so rotating signs nobody out. Without SESSION_SECRET the key comes from CTP_CLIENT_SECRET, as before it
// existed; that key keeps opening older cookies after SESSION_SECRET is set, until the API secret itself is rotated.
// Sealed cookies use their cookie name as AAD, so a guest cookie can never be replayed as a session (or back).
const derive = (secret: string, info: string) => Buffer.from(hkdfSync("sha256", secret, "ct-storefront", info, 32));

let cookieKeys: Buffer[] | undefined;
function keys(): Buffer[] {
  if (cookieKeys) return cookieKeys;
  const own = [process.env.SESSION_SECRET, process.env.SESSION_SECRET_PREVIOUS].filter((s): s is string => !!s);
  if (own.some((s) => s.length < 32)) throw new Error("SESSION_SECRET and SESSION_SECRET_PREVIOUS need at least 32 characters");
  const legacy = process.env.CTP_CLIENT_SECRET;
  if (own.length === 0 && !legacy) throw new Error("SESSION_SECRET (or CTP_CLIENT_SECRET) is required to encrypt sessions");
  cookieKeys = [...own.map((s) => derive(s, "session-cookie-v2")), ...(legacy ? [derive(legacy, "session-cookie-v1")] : [])];
  return cookieKeys;
}

function seal(name: string, value: object): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys()[0], iv, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(name));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function unseal<T>(name: string, value: string | undefined): T | undefined {
  if (!value) return undefined;
  const [iv, tag, data] = value.split(".").map((p) => Buffer.from(p, "base64url"));
  // Fixed lengths: never let a cookie choose a shorter (cheaper to forge) GCM tag.
  if (iv?.length !== 12 || tag?.length !== 16 || !data) return undefined;
  for (const key of keys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
      decipher.setAAD(Buffer.from(name));
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as T;
    } catch {
      // tampered, or sealed with another key: try the next one
    }
  }
  return undefined;
}

export const sealSession = (session: Session) => seal(SESSION_COOKIE, session);

// Writes the session cookie: 30 days with a refresh token (renewed on every save), else until the token expires.
// Server Actions and Route Handlers only.
export async function saveSession(session: Session) {
  (await cookies()).set(SESSION_COOKIE, sealSession(session), {
    ...cookieOptions,
    maxAge: session.refreshToken ? cookieOptions.maxAge : Math.floor((session.expiresAt - Date.now()) / 1000),
  });
}

// Renewed access tokens, by refresh token (hashed): Server Components can't write the cookie, so until the next
// Server Action saves the new token, every request would otherwise refresh again.
const renewed = new Map<string, Promise<{ accessToken: string; expiresAt: number } | undefined>>();

function renew(refreshToken: string) {
  const key = createHash("sha256").update(refreshToken).digest("base64url");
  const hit = renewed.get(key);
  if (hit) return hit;
  const now = Date.now();
  for (const [k, p] of renewed) void p.then((t) => (!t || t.expiresAt <= now + 60_000) && renewed.delete(k));
  const fresh = refreshCustomerToken(refreshToken).then((t) => {
    if (!t) renewed.delete(key);
    return t;
  });
  renewed.set(key, fresh);
  return fresh;
}

export async function getSession(): Promise<Session | undefined> {
  const session = unseal<Session>(SESSION_COOKIE, (await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return undefined;
  // Signed in before a password reset: refused before anything is renewed.
  const issuedAt = session.issuedAt ?? session.expiresAt - TOKEN_LIFETIME_MS;
  if (issuedAt < (await sessionsValidAfter(session.customerId))) return undefined;
  if (session.expiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) return undefined;
  const token = await renew(session.refreshToken);
  if (!token) return undefined;
  const fresh = { ...session, ...token };
  await saveSession(fresh).catch(() => {}); // only works in Server Actions and Route Handlers
  return fresh;
}

// Accounts that signed in on this browser (sealed, so it can't be forged; kept on sign-out). They skip the per-email
// sign-in limit, which strangers could otherwise use to lock the owner out (loginLimits in ./utils).
const DEVICE_COOKIE = "ct_device";
const DEVICE_MAX_AGE = 60 * 60 * 24 * 180;

export async function isKnownDevice(email: string): Promise<boolean> {
  return (unseal<{ emails?: string[] }>(DEVICE_COOKIE, (await cookies()).get(DEVICE_COOKIE)?.value)?.emails ?? []).includes(email);
}

export async function rememberDevice(email: string) {
  const jar = await cookies();
  const emails = unseal<{ emails?: string[] }>(DEVICE_COOKIE, jar.get(DEVICE_COOKIE)?.value)?.emails ?? [];
  jar.set(DEVICE_COOKIE, seal(DEVICE_COOKIE, { emails: rememberAccount(emails, email) }), { ...cookieOptions, maxAge: DEVICE_MAX_AGE });
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

// Whether there is a signed-in session whose token commercetools still accepts (a cookie that no longer decrypts, or
// a revoked token, is not one). Unknown answers count as working, the safe side for the logout confirmation.
export async function sessionWorks(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return customerApiRoot(session.accessToken)
    .me()
    .get()
    .execute()
    .then(() => true)
    .catch((err) => (err as { body?: { statusCode?: number } })?.body?.statusCode !== 401);
}

// Revokes the customer token and drops every sign-in and cart cookie (sign-out, or a session that stopped working).
export async function signOut() {
  const session = await getSession();
  if (session) {
    await revokeToken(session.accessToken);
    if (session.refreshToken) await revokeToken(session.refreshToken, "refresh_token");
  }
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name === SESSION_COOKIE || c.name === GUEST_COOKIE || c.name === BU_COOKIE || c.name.startsWith("ct_cart_")) jar.delete(c.name);
  }
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
