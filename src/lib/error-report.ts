// One JSON line per server error (Next's onRequestError, src/instrumentation.ts), so a log drain or any log search
// can count and group them: by route, by kind, by commercetools status. Paths only: query strings can hold reset
// and invitation codes, and error messages never include request bodies or cookies.
export type RequestInfo = { path: string; method: string };
export type ErrorContext = { routerKind: string; routePath: string; routeType: string; renderSource?: string };

export function errorReport(err: unknown, request: RequestInfo, context: ErrorContext) {
  const e = err as { name?: string; message?: string; digest?: string; body?: { statusCode?: number; errors?: { code?: string }[] } };
  return {
    level: "error",
    event: "request_error",
    route: context.routePath,
    routeType: context.routeType,
    ...(context.renderSource && { renderSource: context.renderSource }),
    method: request.method,
    path: request.path.split("?")[0],
    error: e?.name ?? typeof err,
    message: String(e?.message ?? err).slice(0, 500),
    ...(e?.digest && { digest: e.digest }),
    // commercetools SDK errors: the status and error codes, the useful part of `body`.
    ...(e?.body?.statusCode && { ctStatus: e.body.statusCode, ctCodes: e.body.errors?.map((x) => x.code).filter(Boolean) }),
  };
}

// One JSON line per business event worth an alert (order_failed, step_failed, payment_mismatch, ...), in the same
// shape, so a log drain can count them and alert on them. `context` holds ids only, never names, emails or addresses.
export function eventReport(event: string, err: unknown, context: Record<string, string | number | boolean | undefined> = {}) {
  const e = err as { message?: string; body?: { statusCode?: number; errors?: { code?: string }[] } } | undefined;
  return {
    level: "error",
    event,
    ...context,
    ...(e?.message && { message: String(e.message).slice(0, 500) }),
    ...(e?.body?.statusCode && { ctStatus: e.body.statusCode, ctCodes: e.body.errors?.map((x) => x.code).filter(Boolean) }),
  };
}

export function reportEvent(event: string, err?: unknown, context?: Record<string, string | number | boolean | undefined>) {
  console.error(JSON.stringify(eventReport(event, err, context)));
  // To send them to an error tracker as well (Sentry, Datadog), call its capture function here.
}
