import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Who may call /api/revalidate (it only clears caches, but each call makes the next guests wait for fresh renders):
// the Sanity webhook, jobs and queue pushes, with `Authorization: Bearer <REVALIDATE_SECRET>`.
export const hasRevalidateSecret = (authorization: string | null) => hasBearer(authorization, process.env.REVALIDATE_SECRET);

// Who may call /api/price-extension: commercetools, which sends `Authorization: Bearer <PRICE_EXTENSION_SECRET>`
// (the extension's AuthorizationHeader destination).
export const hasPriceExtensionSecret = (authorization: string | null) => hasBearer(authorization, process.env.PRICE_EXTENSION_SECRET);

// Who may call /api/order-events: the queue a commercetools Subscription delivers order and payment messages to
// (EventBridge API destination or Pub/Sub push), with `Authorization: Bearer <ORDER_EVENTS_SECRET>`.
export const hasOrderEventsSecret = (authorization: string | null) => hasBearer(authorization, process.env.ORDER_EVENTS_SECRET);

// Who may call /api/cron/*: Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`.
export const hasCronSecret = (authorization: string | null) => hasBearer(authorization, process.env.CRON_SECRET);

function hasBearer(authorization: string | null, secret: string | undefined): boolean {
  const given = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!secret || secret.length < 32 || !given) return false;
  // Compare hashes: equal length, constant time.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(secret));
}
