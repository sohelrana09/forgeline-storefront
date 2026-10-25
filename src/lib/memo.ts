// Per-process cache for data that changes rarely (business units, category tree, CMS content).
// Within `ttlMs` the cached value is returned. After that the stale value is still returned at once while ONE
// background load refreshes it, so no request waits for a reload; only the very first load is awaited.
// A failed first load is not cached; a failed refresh keeps serving the stale value and retries after 30 seconds.
// Works in Next and in tsx scripts, unlike unstable_cache.
// Per process: on serverless or multi-instance hosting each instance keeps its own copy (use Next's data cache there).
const RETRY_MS = 30 * 1000;

export function staleWhileRevalidate<T>(ttlMs: number) {
  const entries = new Map<string, { at: number; value: Promise<T>; refreshing: boolean }>();
  const get = (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit && (Date.now() - hit.at < ttlMs || hit.refreshing)) return hit.value;
    if (hit) {
      hit.refreshing = true;
      load()
        .then((fresh) => entries.set(key, { at: Date.now(), value: Promise.resolve(fresh), refreshing: false }))
        .catch((err) => {
          // Keep serving the stale value and try again in 30 seconds, not on every request.
          hit.at = Date.now() - ttlMs + RETRY_MS;
          hit.refreshing = false;
          console.error("cache refresh failed", key, (err as { body?: unknown })?.body ?? err);
        });
      return hit.value;
    }
    const value = load().catch((err) => {
      if (entries.get(key)?.value === value) entries.delete(key);
      throw err;
    });
    entries.set(key, { at: Date.now(), value, refreshing: false });
    return value;
  };
  // After a write that changes the data (e.g. membership), so the next read loads it fresh. `clear` drops every key
  // (content or catalog changed elsewhere, see /api/revalidate).
  return Object.assign(get, { forget: (key: string) => void entries.delete(key), clear: () => entries.clear() });
}
