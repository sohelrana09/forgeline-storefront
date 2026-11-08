import "server-only";
import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { spanAttributes, spanName } from "@/lib/commercetools/trace-attributes";
import { otelEnabled } from "@/lib/otel-config";

// Every commercetools call goes through here (client.ts passes it to the SDK).
// - OpenTelemetry (OTEL_EXPORTER_OTLP_ENDPOINT set, src/lib/otel.ts): one client span per call, named by route
//   ("commercetools GET /{project}/in-store/key={key}/me/carts"), under the page's or action's own span.
// - CT_TRACE=1 logs every call with its duration, to find slow pages.
// Paths and query parameter names only: query values can hold emails or tokens.
const tracer = trace.getTracer("forgeline.commercetools");

export const traceFetch: typeof fetch = async (input, init) => {
  const log = process.env.CT_TRACE === "1";
  const otel = otelEnabled();
  if (!log && !otel) return fetch(input, init);
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const started = performance.now();
  const call = () => fetch(input, init);
  try {
    if (!otel) return await call();
    const project = process.env.CTP_PROJECT_KEY;
    return await tracer.startActiveSpan(
      spanName(method, url, project),
      { kind: SpanKind.CLIENT, attributes: spanAttributes(method, url, project) },
      async (span) => {
        try {
          const res = await call();
          span.setAttribute("http.response.status_code", res.status);
          if (res.status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          return res;
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.name : "fetch failed" });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  } finally {
    if (log) {
      const params = [...new Set(url.searchParams.keys())].join(",");
      const ms = Math.round(performance.now() - started);
      console.info(`[ct] ${String(ms).padStart(5)} ms ${method} ${url.pathname}${params ? ` ?${params}` : ""}`);
    }
  }
};
