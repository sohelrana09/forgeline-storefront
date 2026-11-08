// OpenTelemetry tracing for the Node.js server (registered from src/instrumentation.ts when otelEnabled()). Spans go
// to any OTLP/HTTP backend (Grafana Tempo, Honeycomb, Datadog, New Relic, an OpenTelemetry Collector): set
// OTEL_EXPORTER_OTLP_ENDPOINT, and OTEL_EXPORTER_OTLP_HEADERS for its API key. Next.js's own spans (each request,
// render and route) and ours around commercetools calls (lib/commercetools/trace.ts) end up in one trace.
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, NodeTracerProvider, ParentBasedSampler, TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-node";

export function registerTracing() {
  // Next.js would add a span per fetch with the full URL, query values included (emails in where predicates).
  // Ours record the route only; Next's fetch spans stay off unless someone turns them back on explicitly.
  process.env.NEXT_OTEL_FETCH_DISABLED ??= "1";
  const ratio = Number(process.env.OTEL_TRACES_SAMPLER_ARG ?? "1");
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": process.env.OTEL_SERVICE_NAME ?? "forgeline-storefront",
      "deployment.environment.name": process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    }),
    // A share of traces (OTEL_TRACES_SAMPLER_ARG, 0 to 1, default all), keeping whole traces together.
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 1) }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });
  provider.register();
}
