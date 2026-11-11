# Spec: Observability Logs and Traces

## Intent Description

Extend the existing [metrics](observability-metrics.md) so the operator can
follow a single request or Frigate event in Grafana: structured JSON logs in
VictoriaLogs and distributed-style traces in VictoriaTraces, linked to each
other by `trace_id`. Covers the server only, prod and test stacks.

Delivered in three slices, in this order:

1. **Logs** (this repo): an in-house JSON logger on stdout; every server
   `console.*` call migrates to it.
2. **Infra** (portainer-traefik repo): VictoriaTraces, an Alloy `traces`
   pipeline, Grafana datasources linked both ways.
3. **Traces** (this repo): manual spans for HTTP requests, the MQTT → push
   pipeline and Frigate calls, exported over OTLP/HTTP JSON to Alloy.

Slice 2 ships before slice 3 deploys, so spans never reach an Alloy receiver
with nowhere to send them. Rationale:
[ADR](../memory/decisions/2026-11-11-json-logs-and-manual-traces.md).

## User-Facing Behavior

There is no end-user UI. For the operator:

```gherkin
Feature: Structured logs

  Scenario: Server logs are JSON lines on stdout
    When the server logs anything
    Then stdout receives one JSON object per line with time, level, msg and component

  Scenario: Log level is configurable
    Given LOG_LEVEL is "warn"
    Then debug and info lines are not printed
    And an unset or unknown LOG_LEVEL means "info"

  Scenario: Logs carry the active trace
    Given tracing is on and a span is active
    When the server logs
    Then the line includes trace_id and span_id of that span

  Scenario: No personal data in logs
    When delivery logs a push send or failure
    Then the line has the push service host but no user id, endpoint URL, token, cookie or email

Feature: Traces

  Scenario: Traces are exported when configured
    Given OTEL_EXPORTER_OTLP_ENDPOINT is set
    When a page, API or server-function request is served
    Then one server span is exported for it to that endpoint

  Scenario: Tracing is off by default
    Given OTEL_EXPORTER_OTLP_ENDPOINT is not set
    Then no spans are created or exported and logs have no trace_id

  Scenario: Noise is not traced
    When an asset or /api/health* request is served
    Then no span is created

  Scenario: Push pipeline is traced
    When Frigate publishes a new event and its camera batch flushes
    Then a batch trace shows one push.send span per Device subscription

  Scenario: Errors are visible in both signals
    When a handler logs an error
    Then the log line has err {name, message, stack}
    And the active span has status ERROR and a recorded exception

  Scenario: Jump between signals
    Given a log line with a trace_id in Grafana
    Then it links to that trace in VictoriaTraces
    And a span in VictoriaTraces links to the logs with its trace_id
```

## Design

### Slice 1: Logger

Code: `src/features/shared/server/log/index.ts` (server-only).

```ts
log.debug(component, msg, fields?)
log.info(component, msg, fields?)
log.warn(component, msg, fields?)
log.error(component, msg, err?, fields?)
```

- Writes one `JSON.stringify` line to stdout (`console.log` inside the module
  is the only allowed console call in server code). Same format in dev,
  `dev:e2e`, test and prod.
- Line shape:
  `{"time":"<ISO>","level":"info","component":"mqtt","msg":"…","trace_id":"…","span_id":"…",...fields}`.
  `trace_id` / `span_id` come from `trace.getActiveSpan()` in
  `@opentelemetry/api` and are omitted when no span is active. Fields must not
  overwrite the reserved keys.
- `component` replaces today's `[mqtt]`, `[push/subscribe]`, … prefixes.
- `log.error` serialises `err` as `{name, message, stack}` (non-`Error` values
  as `{message: String(err)}`) and, if a span is active, calls
  `span.recordException(err)` and `span.setStatus({code: ERROR})`.
- `LOG_LEVEL`: `debug` | `info` | `warn` | `error`; unset or unknown is `info`.
  Read once at module load.

Migration: all server-side `console.*` calls (17 files under
`src/features/**/server/` and `src/routes/api/`) move to `log`. A Biome
`noConsole` override for server paths keeps them out. The two client files
(`ServiceWorkerRegistration.tsx`, `pushLocaleSync.ts`) are untouched.

**Data rules** (logs and span attributes alike):

| Allowed                                                            | Never                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| camera name, Frigate event id, labels, counts, durations, outcomes | user id (Google `sub`), email, display name                   |
| push service host (e.g. `web.push.apple.com`)                      | push endpoint URL, `p256dh` / `auth` keys                     |
| URL path                                                           | query string (the OAuth callback carries `code` and `state`)  |
| HTTP method and status                                             | cookies, session data, VAPID / OAuth / Google tokens, headers |

This changes current behaviour: delivery logs `Pushing to user <sub>` and
`Failed to send to <endpoint>`; both lose the identifier (keep device count and
host).

### Slice 2: Infra (portainer-traefik repo)

- **VictoriaTraces** service in `observability/docker-compose.yml`: pinned
  image tag, own volume, retention matching VictoriaLogs, `observability`
  network only, no Traefik route.
- **Alloy** (`observability/alloy/config.alloy`): add `traces` to
  `otelcol.receiver.otlp "default"` and `otelcol.processor.batch "default"`,
  and an `otelcol.exporter.otlphttp "victoriatraces"` to VictoriaTraces' OTLP
  ingest path. Update the header comment ("no traces backend").
- **Grafana** (`provisioning/datasources/datasources.yml`):
  - VictoriaTraces as a Jaeger datasource (its Jaeger query API), with
    `tracesToLogsV2` → VictoriaLogs filtered on `trace_id`.
  - VictoriaLogs gets a derived field: `trace_id` → link to the VictoriaTraces
    datasource.
- Log JSON is **not** parsed in Alloy; queries use `| unpack_json`. The shared
  Alloy log pipeline stays neutral for other containers.

Port, ingest path, Jaeger API path and whether the VictoriaLogs plugin supports
derived fields are to be confirmed against the pinned versions while building
the slice.

### Slice 3: Tracing

Code: `src/features/shared/server/tracing/index.ts` (server-only).

- Packages, all on the same 3.x line as metrics (one `@opentelemetry/resources`
  copy): `@opentelemetry/sdk-trace@3.1.1` (the 3.x name of `sdk-trace-base`),
  `@opentelemetry/exporter-trace-otlp-http@^0.301.1`,
  `@opentelemetry/context-async-hooks@^3.1.1`.
- `startTracing(processor?)` is called once from `src/server.ts` next to
  `startMetrics()`. No-op unless a processor is passed (tests) or
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set. When on:
  - registers `AsyncLocalStorageContextManager` as the global context manager
    (needed for parent lookup across `await`);
  - holds its own `BasicTracerProvider` (not the `@opentelemetry/api` global
    tracer provider, same import-order reason as metrics) with a
    `BatchSpanProcessor` and `OTLPTraceExporter`; same resource as metrics.
- Always sample. No `traceparent` header is sent to Frigate.
- Helper: `withSpan(name, attributes, fn, { kind?, root? })` starts an active
  span, records exception + ERROR status if `fn` throws, ends it. A no-op
  wrapper when tracing is off.

**Spans**

| Span                    | Kind     | Where                                                       | Attributes                                                                                     |
| ----------------------- | -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `{METHOD}` (e.g. `GET`) | server   | `withRequestMetrics` in `src/server.ts`                     | `http.request.method` (`_OTHER` rule), `url.path`, `http.response.status_code`, `request.kind` |
| `mqtt frigate/events`   | consumer | `onFrigateMessage` in `push-notifications/server/mqtt.ts`   | `frigate.camera`, `frigate.event.id`, `frigate.label`, `mqtt.outcome` (`batched` `ignored`)    |
| `push.batch`            | internal | `dispatchBatch` in `mqtt.ts` (root)                         | `frigate.camera`, `frigate.event.ids`, `push.burst_start`                                      |
| `push.availability`     | internal | `dispatchAvailability` in `mqtt.ts` (root)                  | `frigate.camera`, `camera.status`                                                              |
| `push.send`             | client   | per subscription in `push-notifications/server/delivery.ts` | `push.kind`, `push.outcome` (`ok` `expired` `failed`), `push.service.host`                     |
| `frigate {op}`          | client   | the `fetch` calls in `shared/server/frigate/client.ts`      | `http.request.method`, `url.path` (Frigate path), `http.response.status_code`                  |

- No server span for `asset` requests or `/api/health*`; the request still gets
  metrics.
- The server span ends at response headers, matching the metrics duration
  (SSR streams the body).
- Share pushes come from an HTTP request, so their `push.send` spans sit under
  that request's server span.
- **Batching breaks the per-message trace.** A camera batch flushes from the
  batcher's timer, after the messages' spans have ended, and holds several
  events. So `push.batch` is its own root trace; `frigate.event.ids` lets you
  find the `mqtt frigate/events` spans of the events it carries. No span links.
- `frigate/stats`, `frigate/available` and `frigate/reviews` messages get no
  span (stats arrive every few seconds per camera); an availability change
  starts its own `push.availability` trace.
- Cached Frigate reads make no Frigate span; only real fetches do.

**First test of the slice:** a request through the real TanStack Start server
entry under Bun produces child spans (`frigate {op}`) whose parent is the
request's server span. The standalone Bun spike passed 8 propagation cases
(await, setTimeout, `Promise.all`, a stream pulled after the handler returned,
the same in `Bun.serve`) but did not run TanStack Start/Nitro.

### Deployment wiring

No new compose variables for traces: the OTLP exporter reuses
`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`,
`OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES`, and appends `/v1/traces`.
`LOG_LEVEL` is new and optional; add it to [env vars](../agents/env-vars.md).

## Alternatives Considered

- **OTLP logs via the OTel Logs SDK.** Alloy already routes OTLP logs to
  VictoriaLogs, but stdout collection would then duplicate every line unless the
  container sets `logs.collect=false`; logs would be lost whenever Alloy is
  down and `docker logs` would go quiet.
- **pino.** Mature, but a dependency and its own transport model for ~30 lines
  of need.
- **Pretty text in dev.** A second formatter for little gain.
- **Grafana Tempo.** More mature trace↔logs integration in Grafana; rejected to
  keep the stack in one family (VictoriaMetrics, VictoriaLogs, VictoriaTraces).
- **`sdk-node` auto-instrumentation.** Patches Node `http`, unused on Bun.
- **SQLite spans, browser/service-worker telemetry, ratio sampling,
  `traceparent` to Frigate, JSON parsing in Alloy, a hashed user id.** All
  declined; see the ADR.

## Known Limitations

- Server spans and request duration stop at response headers.
- A camera batch trace is separate from the traces of the MQTT messages it
  carries; correlate by event id.
- Trace export failures are silent, like metrics. Spans from a collector outage
  are lost; logs are not (stdout).
- No user id anywhere, so per-user debugging relies on time, camera and event
  id.
- Browser and service-worker logs are not collected.
- VictoriaTraces is newer than Tempo; the Grafana trace↔logs links must be
  checked after the infra slice deploys.
