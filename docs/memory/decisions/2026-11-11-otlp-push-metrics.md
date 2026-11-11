---
tags: [decision, observability, metrics, deployment]
created: 2026-11-11
---

# Metrics are pushed over OTLP/HTTP JSON to Alloy

> The app pushes a small set of metrics to Alloy every 30 s over OTLP/HTTP
> **JSON**, only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. No scraped
> `/metrics` endpoint, no `sdk-node`, no OTLP logs. Spec:
> [docs/specs/observability-metrics.md](../../specs/observability-metrics.md).

## Context

The observability stack (Grafana, VictoriaMetrics, VictoriaLogs, Alloy) lives in
the portainer-traefik repo. Logs already reach VictoriaLogs because Alloy tails
container stdout, so the app needs no change for logs. Metrics were missing:
request latency and errors, MQTT health, push outcomes and memory of the
long-running Bun server. Both the prod and the test stack run the same image
and must be told apart in one dashboard.

## Decision

- **Metrics only, pushed.** `@opentelemetry/exporter-metrics-otlp-http` sends to
  `http://alloy:4318` every 30 s. The app service joins the external
  `observability` network to reach Alloy. Enabled only when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so `bun run dev`, `dev:e2e` and unit
  tests need nothing.
- **JSON, not protobuf.** That exporter sends OTLP/JSON, and Alloy's `:4318`
  accepts it. The protobuf exporter would save bytes (446 B vs 876 B per
  request) but is another dependency. As built the compose files set
  `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`; the spec had assumed
  `http/protobuf`.
- **Own `MeterProvider`, not the `@opentelemetry/api` global.** It is held in
  `src/features/shared/server/metrics/index.ts`. A meter obtained before a
  global provider is registered stays a permanent no-op, which is an
  import-order trap. All `record*` functions are no-ops until `startMetrics()`
  has run, so callers never check whether metrics are on.
- **No `@opentelemetry/sdk-node` or auto-instrumentation.** It patches Node's
  `http` module, which the Bun runtime does not use, so it would record
  nothing. HTTP timing wraps the server entry's fetch handler
  (`withRequestMetrics` in `src/server.ts`). The duration is the time to
  **response headers**: SSR streams the body, so the end of the stream is not
  observed.
- **Spike (ce-i6a.1) passed on Bun 1.4.4.** Versions: `@opentelemetry/api`
  ^1.10.0, `sdk-metrics` ^3.1.1, `exporter-metrics-otlp-http` ^0.301.1,
  `resources` ^3.1.1. With an unreachable collector `forceFlush` and `shutdown`
  resolve and nothing is thrown: exports fail silently and the app keeps
  serving.
- **One service name, environment in the instance id.** Both stacks use
  `service.name=camera-events-v2`. Alloy's OTLP to Prometheus conversion only
  maps `service.name` to `job` and `service.instance.id` to `instance` onto the
  series; other resource attributes land in `target_info`. So the environment
  is carried as `service.instance.id=prod|test`.
  `deployment.environment.name` is also set for completeness. Resource
  attributes come from `OTEL_SERVICE_NAME` / `OTEL_RESOURCE_ATTRIBUTES` through
  `resourceAttributesEnvDetector` and `serviceNameEnvDetector` (the older
  `envDetector` is deprecated).
- **Low cardinality, no personal data.** No path, event ID, camera, user or
  endpoint labels. Unknown HTTP methods collapse to `_OTHER`, unknown MQTT
  topics to `other`. The latency histogram uses the semconv second-scale
  buckets because the SDK defaults are millisecond-scale and would put every
  request in the first bucket.

## Alternatives

- **Scraped Prometheus `/metrics` endpoint.** It would be reachable through the
  public Traefik route and need blocking there, plus a scrape job per stack.
  Push over the internal network exposes nothing.
- **`sdk-node` with auto-instrumentation.** Patches Node `http`; useless on Bun.
- **OTLP logs.** Duplicates what Alloy already collects from stdout.
- **Separate service names per environment.** Rejected by the user in favour of
  one name plus `service.instance.id`.
- **Alloy `resource_to_telemetry_conversion`.** Would copy every resource
  attribute onto series, adding cardinality for every service on the host, to
  fix a problem local to this app.
- **`@opentelemetry/exporter-metrics-otlp-proto`.** Smaller payloads, one more
  dependency, no functional gain here.

## Why it matters

- The wrong global-provider pattern or a Node-only auto-instrumentation looks
  fine in tests and records nothing in production. Keep the provider module
  local and the wrapper explicit.
- Adding a label such as camera or path multiplies series in VictoriaMetrics for
  every stack; keep value sets closed.
- Reading latency: it is time to headers, not total render time.
- Export failures are silent by design. Check Grafana after deploying, not the
  app logs. The `observability` network must exist on the host before the app
  stacks deploy (see README, Deployment).
- RabbitMQ metrics are a follow-up (ce-4zd); the dashboard is ce-i6a.6.
