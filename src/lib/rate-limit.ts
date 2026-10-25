import { headers } from "next/headers";

// Fixed-window throttle (sign-in, sign-up, password reset, new guest carts), in memory: fine for one dev/sandbox
// process. Use a shared store (Redis/Upstash) once the app runs on more than one instance.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();
let lastPrune = 0;

export function tooManyAttempts(key: string, max = MAX_ATTEMPTS): boolean {
  const now = Date.now();
  // Drop expired windows now and then, so made-up keys can't grow the map forever.
  if (now - lastPrune > WINDOW_MS) {
    for (const [k, e] of attempts) if (e.resetAt < now) attempts.delete(k);
    lastPrune = now;
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

// The client address for throttling. Only headers our own proxy sets can be trusted: x-real-ip (nginx, Vercel),
// else the LAST x-forwarded-for hop (added by the nearest proxy; earlier hops are whatever the client sent).
// Without a proxy (local dev) every request shares one bucket. Set the proxy up before production.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "no-proxy";
}
