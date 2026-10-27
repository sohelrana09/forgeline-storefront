import "server-only";
import { headers } from "next/headers";
import { Redis } from "@upstash/redis";

// Fixed-window throttle (sign-in, sign-up, password reset, guest carts, orders, list and company changes).
// With Upstash Redis connected (Vercel Marketplace: Storage → Upstash, which sets KV_REST_API_URL/_TOKEN or
// UPSTASH_REDIS_REST_URL/_TOKEN) every server instance shares the counters. Without it, or if Redis fails, each
// process counts on its own in memory: fine for development, too loose on serverless hosting.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : undefined;
const redisKey = (key: string) => `rl:${key}`;

// ---------- In-memory fallback ----------
const attempts = new Map<string, { count: number; resetAt: number }>();
let lastPrune = 0;

function countInMemory(key: string): number {
  const now = Date.now();
  // Drop expired windows now and then, so made-up keys can't grow the map forever.
  if (now - lastPrune > WINDOW_MS) {
    for (const [k, e] of attempts) if (e.resetAt < now) attempts.delete(k);
    lastPrune = now;
  }
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return 1;
  }
  return ++entry.count;
}

function uncountInMemory(key: string) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt >= Date.now() && --entry.count <= 0) attempts.delete(key);
}

// ---------- Shared counters ----------
// Adds one attempt to the key's current window and returns the count so far.
async function count(key: string): Promise<number> {
  if (redis) {
    try {
      const pipe = redis.pipeline();
      pipe.set(redisKey(key), 0, { nx: true, px: WINDOW_MS }); // starts the window on the first attempt only
      pipe.incr(redisKey(key));
      const [, n] = await pipe.exec<[unknown, number]>();
      return n;
    } catch (err) {
      console.error("rate limit: Redis failed, counting in memory", err);
    }
  }
  return countInMemory(key);
}

// Takes back one attempt. A window that expired in the meantime is not brought back.
async function uncount(key: string): Promise<void> {
  if (redis) {
    try {
      // DECR on a key that has just expired creates it at -1, without an expiry: remove it again.
      if ((await redis.decr(redisKey(key))) <= 0) await redis.del(redisKey(key));
      return;
    } catch (err) {
      console.error("rate limit: Redis failed, counting in memory", err);
    }
  }
  uncountInMemory(key);
}

// Counts this attempt; true once the key has had more than `max` attempts in the current 15-minute window.
export async function tooManyAttempts(key: string, max = MAX_ATTEMPTS): Promise<boolean> {
  return (await count(key)) > max;
}

// For limits that count failures only (sign-in). The attempt is counted on every key before it is tried, so a burst of
// parallel requests can't all pass a check made before any of them failed. Returns undefined when a key is over its
// limit (the attempt is taken back, so refused requests don't extend the block), else `release`, which takes the
// attempt back once it succeeded.
export async function reserveAttempt(limits: { key: string; max: number }[]): Promise<(() => Promise<void>) | undefined> {
  const counts = await Promise.all(limits.map((l) => count(l.key)));
  const release = async () => {
    await Promise.all(limits.map((l) => uncount(l.key)));
  };
  if (counts.some((n, i) => n > limits[i].max)) {
    await release();
    return undefined;
  }
  return release;
}

// The client address for throttling. Only headers our own proxy sets can be trusted: x-real-ip (nginx, Vercel),
// else the LAST x-forwarded-for hop (added by the nearest proxy; earlier hops are whatever the client sent).
// Without a proxy (local dev) every request shares one bucket. Set the proxy up before production.
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "no-proxy";
}
