// Runs once when a server instance starts (Next.js instrumentation).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Node's fetch closes idle connections after 4 s, so most page loads after a pause re-open TLS connections to
  // commercetools and Sanity, and calls made together open extra ones. Keep them open for a minute instead.
  const { Agent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000 }));
}

// Every server error (pages, Server Actions, Route Handlers, the proxy) as one JSON line, for a log drain or search.
// To send them to an error tracker as well (Sentry, Datadog), call its capture function here.
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  const { errorReport } = await import("@/lib/error-report");
  console.error(JSON.stringify(errorReport(err, request, context)));
}
