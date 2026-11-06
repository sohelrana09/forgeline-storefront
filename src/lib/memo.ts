// Per-process cache for data that changes rarely (business units, category tree, CMS content).
// Within `ttlMs` the cached value is returned. After that the stale value is still returned at once while ONE
// background load refreshes it, so no request waits for a reload; only the very first load is awaited.
// A failed first load is not cached; a failed refresh keeps serving the stale value and retries after 30 seconds.
// `maxStaleMs` limits that: a value older than ttlMs + maxStaleMs is not served while a reload can answer, so an
// instance that had no traffic for an hour can't answer with an hour-old membership. Use 0 for anything a security
// decision rests on. If that reload fails, the old value is still served (an outage must not take the shop down).
// Works in Next and in tsx scripts, unlike unstable_cache.
// Per process: on serverless or multi-instance hosting each instance keeps its own copy, and forget() reaches only
// this one (use Next's data cache for data that must clear everywhere).
import { keepAlive } from "@/lib/keep-alive";

const RETRY_MS = 30 * 1000;

type Entry<T> = { at: number; loadedAt: number; value: Promise<T>; refreshing?: Promise<T> };

export function staleWhileRevalidate<T>(ttlMs: number, { maxStaleMs = Infinity }: { maxStaleMs?: number } = {}) {
  const entries = new Map<string, Entry<T>>();
  // Bumped by forget(key) / clear(): a refresh of that key that started before must not write its older result
  // back. Per key, so forgetting one key never touches another key's refresh.
  const generations = new Map<string, number>();
  let epoch = 0;
  const generation = (key: string) => `${epoch}:${generations.get(key) ?? 0}`;
  const refresh = (key: string, hit: Entry<T>, load: () => Promise<T>) => {
    const started = generation(key);
    const pending = load().then(
      (fresh) => {
        const now = Date.now();
        // Forgotten meanwhile: the entry is gone and the next read loads afresh.
        if (generation(key) === started) entries.set(key, { at: now, loadedAt: now, value: Promise.resolve(fresh) });
        return fresh;
      },
      (err) => {
        // Keep serving the stale value and try again in 30 seconds, not on every request.
        hit.at = Date.now() - ttlMs + RETRY_MS;
        hit.refreshing = undefined;
        console.error("cache refresh failed", key, (err as { body?: unknown })?.body ?? err);
        return hit.value;
      },
    );
    hit.refreshing = pending;
    keepAlive(pending);
    return pending;
  };
  const get = (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit) {
      const now = Date.now();
      if (now - hit.at < ttlMs) return hit.value;
      const tooOld = now - hit.loadedAt >= ttlMs + maxStaleMs;
      const pending = hit.refreshing ?? refresh(key, hit, load);
      return tooOld ? pending : hit.value;
    }
    const now = Date.now();
    const value = load().catch((err) => {
      if (entries.get(key)?.value === value) entries.delete(key);
      throw err;
    });
    entries.set(key, { at: now, loadedAt: now, value });
    return value;
  };
  // After a write that changes the data (e.g. membership), so the next read loads it fresh. `clear` drops every key
  // (content or catalog changed elsewhere, see /api/revalidate).
  const forget = (key: string) => {
    generations.set(key, (generations.get(key) ?? 0) + 1);
    entries.delete(key);
  };
  const clear = () => {
    epoch++;
    generations.clear();
    entries.clear();
  };
  return Object.assign(get, { forget, clear });
}
