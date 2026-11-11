---
tags: [decision, observability, logs, traces, deployment]
created: 2026-11-11
---

# JSON logs on stdout and manual traces to VictoriaTraces

> Logs stay on stdout (collected by Alloy) but become one JSON object per line
> with `trace_id`. Traces are manual spans exported over OTLP/HTTP JSON to
> Alloy and on to VictoriaTraces. Extends
> [[decisions/2026-11-11-otlp-push-metrics]]. Spec:
> [docs/specs/observability-logs-traces.md](../../specs/observability-logs-traces.md).

## Context

Metrics already reach VictoriaMetrics over OTLP. Logs reach VictoriaLogs
because Alloy tails container stdout, but they are free text from 43
`console.*` calls, with no way to tie a line to a request or Frigate event.
Some lines contain the user's Google `sub` and full push endpoint URLs. There
is no trace backend; Alloy's OTLP receiver handles metrics and logs only. The
server runs on Bun.

## Decision

- **Logs: JSON on stdout, not OTLP logs.** An in-house module
  (`src/features/shared/server/log`) prints `{time, level, component, msg,
trace_id, span_id, ...fields}`. Same format in every environment. `LOG_LEVEL`
  (default `info`). Every server `console.*` call migrates; Biome `noConsole`
  guards server paths. VictoriaLogs turns each JSON line into fields on
  ingest; Alloy only adds `VL-Msg-Field: msg,_msg` so `msg` is the displayed
  message (the plan had assumed `| unpack_json` at query time).
- **Traces: manual spans, own provider.** `@opentelemetry/sdk-trace` 3.x (the
  renamed `sdk-trace-base`) with `BatchSpanProcessor` and
  `exporter-trace-otlp-http`, held in a module-local `TracerProvider` (3.x name of `BasicTracerProvider`), on
  only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Context crosses `await`s via
  `AsyncLocalStorageContextManager`.
- **Spans:** one server span per request (not assets or health probes),
  `mqtt frigate/events` per new event message, a root `push.batch` /
  `push.availability` per flush, `push.send` per Device subscription, and a
  client span per real Frigate fetch. Always sampled. No `traceparent` to
  Frigate.
- **Errors in both signals.** `log.error` writes `err {name, message, stack}`
  and marks the active span ERROR with `recordException`.
- **No user identifiers.** No Google `sub` (raw or hashed), email, endpoint URL,
  key, token, cookie or query string in logs or span attributes. Camera, event
  id, push service host and URL path are allowed.
- **Backend: VictoriaTraces** in the portainer-traefik observability stack,
  internal only, read by Grafana as a Jaeger datasource, linked both ways with
  VictoriaLogs on `trace_id`. Infra ships before the app's tracing slice.

## Alternatives

- **OTLP logs.** Duplicates stdout collection (or needs `logs.collect=false`),
  loses logs when Alloy is down, silences `docker logs`.
- **pino.** A dependency for ~30 lines of need.
- **Grafana Tempo.** Better-known Grafana integration, but a second tool family
  next to VictoriaMetrics and VictoriaLogs.
- **`sdk-node` auto-instrumentation.** Patches Node `http`; records nothing on
  Bun.
- **Global tracer provider.** A tracer fetched before registration stays a
  no-op; same trap as metrics.
- **Hashed or raw user id.** Easier per-user debugging, but puts a personal
  identifier in two more stores.
- **Ratio sampling.** Unneeded at homelab traffic.
- **SQLite spans, browser/SW telemetry, JSON parsing in Alloy, `traceparent`
  to Frigate.** Noise, a public ingest endpoint, config for one container, or
  no receiver respectively.

## Why it matters

- **`msg` is not `_msg`.** VictoriaLogs parses JSON log lines itself and looks
  for `_msg`. Without Alloy's `VL-Msg-Field: msg,_msg` header every app line
  reads "missing \_msg field" in Grafana, though all fields are stored. Do not
  rename the logger's `msg` key to fix it.

- **Bun context propagation was proved standalone only.** A spike on Bun 1.4.4
  passed all 8 cases (await, setTimeout, `Promise.all`, late stream pull,
  `Bun.serve`) but not through TanStack Start/Nitro. The tracing slice starts
  with that integration test.
- **Package naming trap.** `@opentelemetry/sdk-trace-base` tops out at 2.x; on
  the 3.x line it is `@opentelemetry/sdk-trace`. Mixing 2.x trace with 3.x
  metrics pulls two `resources` copies.
- **Batching splits traces.** A camera batch flushes from a timer and merges
  several events, so `push.batch` is its own root trace; find the message spans
  through `frigate.event.ids`.
- **Logging changes behaviour.** Delivery's current lines lose the user id and
  endpoint URL; keep it that way when adding logs.
