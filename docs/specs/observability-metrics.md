# Spec: Observability Metrics

## Intent Description

Give the operator a view of the running app in Grafana: request latency and
errors, MQTT health, Web Push outcomes and server memory, for both the prod and
the test stack. Logs already reach VictoriaLogs because Alloy tails container
stdout; this feature adds **metrics only**.

The app pushes metrics over OTLP/HTTP JSON to Alloy (`http://alloy:4318`) every
30 seconds. Metrics are enabled only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set;
otherwise every record call is a no-op, so dev, `dev:e2e` and unit tests are
unaffected. Rationale: [ADR](../memory/decisions/2026-11-11-otlp-push-metrics.md).

## User-Facing Behavior

There is no end-user UI. For the operator:

```gherkin
Feature: Operational metrics

  Scenario: Metrics are pushed when configured
    Given OTEL_EXPORTER_OTLP_ENDPOINT is set
    When the server starts
    Then metrics are exported to that endpoint every 30 seconds

  Scenario: Metrics are off by default
    Given OTEL_EXPORTER_OTLP_ENDPOINT is not set
    When the server runs
    Then nothing is exported and recording has no effect

  Scenario: Collector unreachable
    Given the collector cannot be reached
    Then exports fail silently and the app keeps serving requests

  Scenario: Prod and test are told apart
    Given both stacks use service name camera-events-v2
    Then the series carry instance="prod" or instance="test"
```

## Design

Code: `src/features/shared/server/metrics/index.ts`. `startMetrics()` is called
once from `src/server.ts`. It creates its own `MeterProvider` (not the
`@opentelemetry/api` global) with a `PeriodicExportingMetricReader` (30 s) and
an `OTLPMetricExporter`. The resource comes from `OTEL_SERVICE_NAME` and
`OTEL_RESOURCE_ATTRIBUTES` (`serviceNameEnvDetector`,
`resourceAttributesEnvDetector`).

HTTP timing wraps the server entry's fetch handler with `withRequestMetrics`.
The duration is the time until the response headers are available.

### Resource

| Attribute                     | Value                            |
| ----------------------------- | -------------------------------- |
| `service.name`                | `camera-events-v2` (both stacks) |
| `service.instance.id`         | `prod` or `test`                 |
| `deployment.environment.name` | `prod` or `test`                 |

Alloy maps only `service.name` to `job` and `service.instance.id` to `instance`
on series; the other attributes land in `target_info`.

### Metrics

Meter name `camera-events-v2`.

| Name                           | Type               | Unit | Attributes (values)                                                                                                                                                                                                             | Recorded in                                                      |
| ------------------------------ | ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `http.server.request.duration` | histogram          | `s`  | `http.request.method` (`GET` `HEAD` `POST` `PUT` `PATCH` `DELETE` `OPTIONS`, else `_OTHER`); `http.response.status_class` (`2xx`..`5xx`, `500` assumed if the handler throws); `request.kind` (`serverFn` `api` `asset` `page`) | `withRequestMetrics` in `src/server.ts`                          |
| `mqtt.messages`                | counter            | none | `topic` (`frigate/events` `frigate/reviews` `frigate/stats` `frigate/available`, else `other`)                                                                                                                                  | `onFrigateMessage` in `push-notifications/server/mqtt.ts`        |
| `mqtt.connected`               | observable gauge   | none | none (1 while connected to the broker, else 0)                                                                                                                                                                                  | callback registered by `observeMqttConnection` in `mqtt.ts`      |
| `push.sends`                   | counter            | none | `kind` (`motion` `availability` `share`, the Delivery kind); `outcome` (`ok` `expired` `failed`)                                                                                                                                | per-subscription send in `push-notifications/server/delivery.ts` |
| `process.memory.rss`           | observable gauge   | `By` | none                                                                                                                                                                                                                            | callback in `startMetrics`                                       |
| `process.memory.heap_used`     | observable gauge   | `By` | none                                                                                                                                                                                                                            | callback in `startMetrics`                                       |
| `process.cpu.time`             | observable counter | `s`  | `cpu.mode` (`user` `system`)                                                                                                                                                                                                    | callback in `startMetrics`                                       |

Histogram buckets (seconds): 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5,
0.75, 1, 2.5, 5, 7.5, 10. They replace the SDK defaults, which are
millisecond-scale.

`request.kind` rules: `/_serverFn*` is `serverFn`, `/api/*` is `api`,
`/assets/*` or a known static extension is `asset`, everything else is `page`.
Frigate event IDs contain dots, so only known extensions count as assets.

`push.sends` is counted per Share/Alert/Availability notification sent to one
Device subscription, after Mute has been applied (a Delivery swallowed by Mute
records nothing).

### Expected names in VictoriaMetrics

Alloy's OTLP to Prometheus conversion turns dots into underscores, appends the
unit to the name, and adds `_total` to counters; histograms get `_bucket`,
`_sum` and `_count`. These are the **expected** names; confirm them in Grafana
Explore after the first deploy.

| OTel name                      | Expected Prometheus name                                          |
| ------------------------------ | ----------------------------------------------------------------- |
| `http.server.request.duration` | `http_server_request_duration_seconds_bucket` / `_sum` / `_count` |
| `mqtt.messages`                | `mqtt_messages_total`                                             |
| `mqtt.connected`               | `mqtt_connected`                                                  |
| `push.sends`                   | `push_sends_total`                                                |
| `process.memory.rss`           | `process_memory_rss_bytes`                                        |
| `process.memory.heap_used`     | `process_memory_heap_used_bytes`                                  |
| `process.cpu.time`             | `process_cpu_time_seconds_total`                                  |

Attribute names become labels the same way (`http_request_method`,
`http_response_status_class`, `request_kind`, `topic`, `kind`, `outcome`).

```promql
# p95 request latency (to headers) per environment, pages only
histogram_quantile(0.95,
  sum by (le, instance) (
    rate(http_server_request_duration_seconds_bucket{job="camera-events-v2", request_kind="page"}[5m])))

# 5xx ratio
sum by (instance) (rate(http_server_request_duration_seconds_count{http_response_status_class="5xx"}[5m]))
  / sum by (instance) (rate(http_server_request_duration_seconds_count[5m]))

# Frigate MQTT messages per second by topic
sum by (topic) (rate(mqtt_messages_total{instance="prod"}[5m]))

# Broker connection down
mqtt_connected{instance="prod"} == 0

# Push sends by outcome in the last hour
sum by (kind, outcome) (increase(push_sends_total{instance="prod"}[1h]))

# Memory
process_memory_rss_bytes{instance="prod"}
```

### Deployment wiring

`docker-compose.yml` and `docker-compose.test.yml` set
`OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4318`,
`OTEL_EXPORTER_OTLP_PROTOCOL=http/json`, `OTEL_SERVICE_NAME=camera-events-v2` and
`OTEL_RESOURCE_ATTRIBUTES=service.instance.id=<env>,deployment.environment.name=<env>`,
and join the external `observability` network. See
[env vars](../agents/env-vars.md) and the README Deployment section.

## Alternatives Considered

- **Scraped `/metrics` endpoint:** reachable via the public Traefik route unless
  blocked; needs scrape config per stack.
- **`@opentelemetry/sdk-node` auto-instrumentation:** patches Node `http`, which
  Bun does not use; would record nothing.
- **OTLP logs:** duplicates stdout collection by Alloy.
- **Separate service names per environment:** one name with the environment in
  `service.instance.id` was chosen.
- **Alloy `resource_to_telemetry_conversion`:** adds cardinality for every
  service on the host.
- **Protobuf exporter:** smaller payload but one more dependency; JSON works with
  Alloy `:4318`.

## Known Limitations

- Request duration is time to **response headers**, not the end of the streamed
  body (streaming SSR).
- Export failures are silent: no log, no retry beyond the next 30 s interval.
  Metrics from a collector outage are lost.
- No per-route, per-camera, per-user or per-Device labels, by design.
- RabbitMQ broker metrics are not included; follow-up ce-4zd.
- The Grafana dashboard lives in the portainer-traefik repo; follow-up ce-i6a.6.
- Metric names above are expected conversions, not yet verified against
  VictoriaMetrics.
