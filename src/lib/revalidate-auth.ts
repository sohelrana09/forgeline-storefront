import "server-only";
import { createHash, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

// Who may call /api/revalidate (it only clears caches, but each call makes the next guests wait for fresh renders):
//   - scripts, jobs and queue pushes: `Authorization: Bearer <REVALIDATE_SECRET>`
//   - the Merchant Center Content app: through Merchant Center's /proxy/forward-to, which sends a short-lived JWT
//     signed by the Merchant Center API for the signed-in user. The browser never holds a secret.

export function hasRevalidateSecret(authorization: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  const given = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!secret || secret.length < 32 || !given) return false;
  // Compare hashes: equal length, constant time.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

// Merchant Center API of the project's region (aws-us = us-east-2).
const MC_API_URL = (process.env.MC_API_URL ?? "https://mc-api.us-east-2.aws.commercetools.com").replace(/\/+$/, "");
const JWKS_TTL_MS = 60 * 60 * 1000;
// Anyone can send a token with a made-up kid: reload the key set for an unknown kid at most once a minute.
const JWKS_MIN_REFRESH_MS = 60 * 1000;
const CLOCK_SKEW_S = 10;
type Jwk = JsonWebKey & { kid?: string };
let jwks: { at: number; keys: Jwk[] } | undefined;
let loading: Promise<void> | undefined;

// One shared load at a time, 3 s timeout; a failed load keeps the previous keys and is retried after a minute.
function loadKeys(): Promise<void> {
  loading ??= fetch(`${MC_API_URL}/.well-known/jwks.json`, { cache: "no-store", signal: AbortSignal.timeout(3000) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`JWKS ${res.status}`);
      jwks = { at: Date.now(), keys: ((await res.json()) as { keys: Jwk[] }).keys };
    })
    .catch((err) => {
      console.error("Merchant Center JWKS load failed", err);
      jwks = { at: Date.now() - JWKS_TTL_MS + JWKS_MIN_REFRESH_MS, keys: jwks?.keys ?? [] };
    })
    .finally(() => {
      loading = undefined;
    });
  return loading;
}

async function signingKey(kid: string): Promise<Jwk | undefined> {
  if (!jwks || Date.now() - jwks.at > JWKS_TTL_MS) await loadKeys();
  const key = jwks?.keys.find((k) => k.kid === kid);
  if (key || !jwks || Date.now() - jwks.at < JWKS_MIN_REFRESH_MS) return key;
  // Possibly a rotated key.
  await loadKeys();
  return jwks?.keys.find((k) => k.kid === kid);
}

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

// Verifies a Merchant Center forward-to exchange token: RS256 signature from the MC API's keys, issuer, audience
// (the full URL the app forwarded to), expiry, type and our project. Returns the user id, or undefined.
export async function merchantCenterUser(authorization: string | null, audience: string): Promise<string | undefined> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  const parts = token?.split(".");
  if (!parts || parts.length !== 3) return undefined;
  try {
    const header = decode(parts[0]) as { alg?: string; kid?: string };
    if (header.alg !== "RS256" || !header.kid) return undefined;
    const jwk = await signingKey(header.kid);
    if (jwk?.kty !== "RSA") return undefined;
    const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
    if (!verify("RSA-SHA256", signed, createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
      return undefined;
    }
    const claims = decode(parts[1]) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    const ok =
      claims.iss === MC_API_URL &&
      (Array.isArray(claims.aud) ? claims.aud.includes(audience) : claims.aud === audience) &&
      claims.type === "exchange" &&
      typeof claims.exp === "number" &&
      claims.exp > now - CLOCK_SKEW_S &&
      (claims.nbf === undefined || (typeof claims.nbf === "number" && claims.nbf <= now + CLOCK_SKEW_S)) &&
      claims[`${MC_API_URL}/claims/project_key`] === process.env.CTP_PROJECT_KEY &&
      typeof claims.sub === "string";
    return ok ? (claims.sub as string) : undefined;
  } catch {
    return undefined;
  }
}
