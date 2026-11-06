// Keeps a serverless function alive until background work ends (a memo refresh, the proxy's URL index), through the
// host's waitUntil (Vercel publishes it under this symbol). Elsewhere (a Node server, tsx scripts) it does nothing:
// the process stays up anyway. `after()` from Next can't be used here: this runs outside requests in scripts too.
const CONTEXT = Symbol.for("@next/request-context");

type HostContext = { get?: () => { waitUntil?: (promise: Promise<unknown>) => void } | undefined };

export function keepAlive(promise: Promise<unknown>) {
  (globalThis as unknown as Record<symbol, HostContext | undefined>)[CONTEXT]?.get?.()?.waitUntil?.(promise);
}
