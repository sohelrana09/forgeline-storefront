import "server-only";
import { readFile, rename, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { LadderFields } from "@/features/company-pricing/types";

// The price store: the source shop's KeyDB model, one hash per `CardCode|ItemCode`, field = QuantityFrom ("" for 1),
// value = {"p": price, "ud": unix time}. Upstash Redis when its env vars are set (Vercel: Storage → Upstash, the same
// vars as src/lib/rate-limit.ts), else the git-ignored JSON file the sync writes (local development only).
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : undefined;

export const PRICE_FILE = path.join(process.cwd(), "data", "nz-trade", "customer-prices.json");

export const priceKey = (cardCode: string, sku: string) => `${cardCode}|${sku}`;
export const priceStoreName = () => (redis ? "Upstash Redis" : PRICE_FILE);

export class PriceStoreUnavailable extends Error {}

async function readFileStore(): Promise<Record<string, LadderFields>> {
  try {
    return JSON.parse(await readFile(PRICE_FILE, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      throw new PriceStoreUnavailable(`no price store: set Upstash env vars or run the price sync (${PRICE_FILE})`);
    throw err;
  }
}

const emptyWhenMissing = (err: unknown): Record<string, LadderFields> => {
  if (err instanceof PriceStoreUnavailable) return {};
  throw err;
};

// The hashes for these keys, in order (null when missing).
export async function readLadderFields(keys: string[]): Promise<(LadderFields | null)[]> {
  if (keys.length === 0) return [];
  if (redis) {
    const pipe = redis.pipeline();
    for (const key of keys) pipe.hgetall(key);
    return (await pipe.exec()) as (LadderFields | null)[];
  }
  const all = await readFileStore();
  return keys.map((key) => all[key] ?? null);
}

// Every key of these companies (for the sync's comparison).
export async function companyKeys(cardCodes: string[]): Promise<string[]> {
  if (redis) {
    const keys: string[] = [];
    for (const code of cardCodes) {
      let cursor = "0";
      do {
        const [next, found] = await redis.scan(cursor, { match: `${code}|*`, count: 1000 });
        keys.push(...found);
        cursor = String(next);
      } while (cursor !== "0");
    }
    return keys;
  }
  const all = await readFileStore().catch(emptyWhenMissing);
  return Object.keys(all).filter((key) => cardCodes.some((code) => key.startsWith(`${code}|`)));
}

// Replaces changed hashes (each in one transaction, so a reader never sees half a ladder) and removes old ones.
export async function writeLadderFields(set: Record<string, LadderFields>, remove: string[]): Promise<void> {
  if (redis) {
    const entries = Object.entries(set);
    for (let i = 0; i < entries.length; i += 200) {
      const tx = redis.multi();
      for (const [key, fields] of entries.slice(i, i + 200)) {
        tx.del(key);
        tx.hset(key, fields);
      }
      await tx.exec();
    }
    for (let i = 0; i < remove.length; i += 500) await redis.del(...remove.slice(i, i + 500));
    return;
  }
  const all = await readFileStore().catch(emptyWhenMissing);
  Object.assign(all, set);
  for (const key of remove) delete all[key];
  await mkdir(path.dirname(PRICE_FILE), { recursive: true });
  await writeFile(`${PRICE_FILE}.tmp`, JSON.stringify(all));
  await rename(`${PRICE_FILE}.tmp`, PRICE_FILE);
}
