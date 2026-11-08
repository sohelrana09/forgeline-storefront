// Runs once when a server instance starts (Next.js instrumentation).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Node's fetch closes idle connections after 4 s, so most page loads after a pause re-open TLS connections to
  // commercetools and Sanity, and calls made together open extra ones. Keep them open for a minute instead.
  const { Agent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000 }));
  // Traces to an OTLP backend, only when one is configured (docs/features/quality-gates.md).
  const { otelEnabled } = await import("@/lib/otel-config");
  if (otelEnabled()) (await import("@/lib/otel")).registerTracing();
  // A production deployment must not look healthy while it is misconfigured.
  if (process.env.NODE_ENV === "production") {
    const { checkEnv } = await import("@/lib/env");
    const { missing, degraded } = checkEnv(process.env);
    for (const warning of degraded) console.error(JSON.stringify({ level: "error", event: "config_degraded", warning }));
    if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")} (see .env.example)`);
  }
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
