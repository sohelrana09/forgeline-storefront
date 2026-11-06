import { createHmac, timingSafeEqual } from "node:crypto";

// Sanity signs its webhooks: `sanity-webhook-signature: t=<ms>,v1=<base64url HMAC-SHA256 of "<t>.<body>">`. Checking it
// proves the body came from Sanity and, with the time, that it isn't an old request sent again. Pure, unit-tested.
export const SIGNATURE_HEADER = "sanity-webhook-signature";
const MAX_AGE_MS = 5 * 60_000;

export const signSanityBody = (secret: string, timestamp: number, body: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("base64url");

export function validSanitySignature(header: string, body: string, secret: string, now: number): boolean {
  const fields = Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)));
  const timestamp = Number(fields.t);
  if (!fields.v1 || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_AGE_MS) return false;
  const given = Buffer.from(fields.v1);
  const expected = Buffer.from(signSanityBody(secret, timestamp, body));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
