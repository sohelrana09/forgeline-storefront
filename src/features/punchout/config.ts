import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// PunchOut connections (docs/features/punchout.md), pure and unit-tested. One Custom Object per business unit
// (container "punchout-config", key = unit key) says which procurement system may open sessions for that unit, as
// which associate, and where carts may be returned. The shared secret is stored as a scrypt hash only.

export const CONFIG_CONTAINER = "punchout-config";
export const SESSION_CONTAINER = "punchout-session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const START_TTL_MS = 5 * 60 * 1000;

export const punchoutEnabled = (env: Record<string, string | undefined> = process.env) => env.PUNCHOUT === "true";

export type Format = "cxml" | "oci";

export type PunchoutConfig = {
  unitKey: string;
  // The buyer's identity as their system sends it (cXML From/Credential, OCI USERNAME).
  domain: string;
  identity: string;
  // The associate whose account the session cart belongs to (prices, approval rules, budgets follow them).
  customerId: string;
  salt: string;
  secretHash: string;
  // Hosts the cart may be returned to (the BrowserFormPost / HOOK_URL), https only.
  returnHosts: string[];
  formats: Format[];
  // How the buyer's system knows us (From in the PunchOutOrderMessage).
  supplier: { domain: string; identity: string };
};

const SCRYPT = { N: 16384, r: 8, p: 1 };
export const hashSecret = (secret: string, salt: string) => scryptSync(secret, salt, 32, SCRYPT).toString("hex");
export const newSalt = () => randomBytes(16).toString("hex");

// Constant time, and false for anything malformed.
export function verifySecret(secret: string | undefined, config: Pick<PunchoutConfig, "salt" | "secretHash">): boolean {
  if (!secret || secret.length > 256 || !/^[0-9a-f]{64}$/.test(config.secretHash)) return false;
  const expected = Buffer.from(config.secretHash, "hex");
  const actual = Buffer.from(hashSecret(secret, config.salt), "hex");
  return timingSafeEqual(expected, actual);
}

const host = /^(?=.{1,253}$)([a-z0-9-]+\.)*[a-z0-9-]+$/;

export function parseConfig(value: unknown): PunchoutConfig | undefined {
  const v = value as Partial<PunchoutConfig> | undefined;
  if (!v || typeof v !== "object") return undefined;
  const ok =
    typeof v.unitKey === "string" &&
    typeof v.domain === "string" &&
    typeof v.identity === "string" &&
    v.identity.length > 0 &&
    typeof v.customerId === "string" &&
    /^[0-9a-f-]{36}$/.test(v.customerId) &&
    typeof v.salt === "string" &&
    typeof v.secretHash === "string" &&
    Array.isArray(v.returnHosts) &&
    v.returnHosts.every((h) => typeof h === "string" && host.test(h)) &&
    Array.isArray(v.formats) &&
    v.formats.every((f) => f === "cxml" || f === "oci") &&
    !!v.supplier &&
    typeof v.supplier.identity === "string";
  return ok ? (v as PunchoutConfig) : undefined;
}

// The return URL must be https on a configured host (exact match), with no credentials in it.
export function returnUrlAllowed(url: string, hosts: string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password && hosts.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// What the session cookie and the one-time start object hold.
export type PunchoutSession = {
  unitKey: string;
  customerId: string;
  cartId: string;
  format: Format;
  returnUrl: string;
  buyerCookie: string;
  // cXML: who the buyer is (To in our message) and who we are (From). OCI: the HOOK_URL's extra fields.
  buyer: { domain: string; identity: string };
  supplier: { domain: string; identity: string };
  oci?: { target?: string; caller?: string };
  expiresAt: number;
};
