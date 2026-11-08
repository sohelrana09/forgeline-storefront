// OpenTelemetry is on when an OTLP endpoint is configured (the standard variables; the exporter reads them itself,
// including OTEL_EXPORTER_OTLP_HEADERS for the vendor's API key). docs/features/quality-gates.md.
export const otelEnabled = () => Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
