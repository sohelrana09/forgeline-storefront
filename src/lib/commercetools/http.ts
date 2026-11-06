import { traceFetch } from "@/lib/commercetools/trace";

// Every call to commercetools goes through here. Without a limit a slow commercetools holds a server function until
// undici's 5 minute default, so a brownout becomes hung pages instead of quick errors.
// Reads are retried on the statuses that mean "not processed". Writes never are: a write that timed out may have
// worked, so retrying one could create a second order. Their callers re-read instead (orderFromCart, version checks).
export const READ_TIMEOUT_MS = 8_000;
export const WRITE_TIMEOUT_MS = 15_000;
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const READ_RETRIES = 2;
const RETRY_DELAY_MS = 150;

const isRead = (method: string | undefined) => {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
};

export function resilient(base: typeof fetch, delay = (ms: number) => new Promise((r) => setTimeout(r, ms))): typeof fetch {
  return async (input, init) => {
    const method = init?.method ?? (input instanceof Request ? input.method : undefined);
    const read = isRead(method);
    const limit = AbortSignal.timeout(read ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    const signal = init?.signal ? AbortSignal.any([init.signal, limit]) : limit;
    for (let attempt = 0; ; attempt++) {
      const retry = read && attempt < READ_RETRIES;
      try {
        const res = await base(input, { ...init, signal });
        if (!retry || !RETRY_STATUS.has(res.status)) return res;
        await res.body?.cancel().catch(() => undefined);
      } catch (err) {
        // A timeout has used up the time budget; only a connection failure is worth repeating.
        if (!retry || signal.aborted) throw err;
      }
      await delay(RETRY_DELAY_MS * 2 ** attempt);
    }
  };
}

export const ctFetch = resilient(traceFetch);
