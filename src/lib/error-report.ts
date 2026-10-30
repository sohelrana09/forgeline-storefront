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
