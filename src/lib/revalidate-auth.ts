import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Who may call /api/revalidate (it only clears caches, but each call makes the next guests wait for fresh renders):
// the Sanity webhook, jobs and queue pushes, with `Authorization: Bearer <REVALIDATE_SECRET>`.

export function hasRevalidateSecret(authorization: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  const given = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!secret || secret.length < 32 || !given) return false;
  // Compare hashes: equal length, constant time.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(secret));
}
