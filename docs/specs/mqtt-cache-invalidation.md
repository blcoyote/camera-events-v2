# Spec: MQTT Event-Driven Cache Invalidation

## Intent Description

Frigate publishes event updates to MQTT topics (`frigate/events`, `frigate/reviews`). Our app already has a RabbitMQ instance in docker-compose with the MQTT plugin enabled, and an `MQTT_URL` environment variable wired to the app container. When Frigate posts an event, our server must receive the MQTT message and immediately clear the in-memory Frigate API cache (`clearFrigateCache`) so that subsequent page loads fetch fresh data.

The MQTT event handler must be a top-level, clearly visible function — not buried inside infrastructure code — because it will be extended in the future to drive additional behavior (e.g., real-time push to clients, notifications, event aggregation).

The connection will use the `mqtt` npm package (MQTT.js v5) to subscribe to `frigate/events` and `frigate/reviews` over MQTT (port 1883). The subscriber starts when the server starts and reconnects automatically. If `MQTT_URL` is not set, the subscriber is silently skipped (local dev without RabbitMQ).

## User-Facing Behavior

```gherkin
Feature: MQTT event-driven cache invalidation
  When Frigate publishes an event to MQTT, the server clears
  its API cache so users see fresh data on next page load.

  Background:
    Given the MQTT_URL environment variable is set
    And the RabbitMQ broker is reachable

  Scenario: Server subscribes to Frigate topics on startup
    When the server starts
    Then it connects to the MQTT broker at MQTT_URL
    And subscribes to "frigate/events"
    And subscribes to "frigate/reviews"

  Scenario: Frigate event clears the cache
    Given the server is connected to the MQTT broker
    And the Frigate API cache contains cached responses
    When Frigate publishes a message to "frigate/events"
    Then the server clears the entire Frigate API cache
    And the next page load fetches fresh data from Frigate

  Scenario: Frigate review clears the cache
    Given the server is connected to the MQTT broker
    And the Frigate API cache contains cached responses
    When Frigate publishes a message to "frigate/reviews"
    Then the server clears the entire Frigate API cache

  Scenario: MQTT_URL not set — subscriber skipped
    Given the MQTT_URL environment variable is not set
    When the server starts
    Then no MQTT connection is attempted
    And the server operates normally without MQTT

  Scenario: MQTT broker temporarily unreachable
    Given the server is started with MQTT_URL set
    And the MQTT broker is not reachable
    When the server attempts to connect
    Then it retries automatically using MQTT.js reconnection
    And the server continues to operate normally during retry

  Scenario: MQTT connection lost and recovered
    Given the server is connected to the MQTT broker
    When the MQTT connection drops
    Then the client automatically reconnects
    And re-subscribes to "frigate/events" and "frigate/reviews"

  Scenario: Handler function is accessible for future extension
    Given a developer wants to add behavior when Frigate events arrive
    Then the onFrigateMessage handler is exported from a top-level server module
    And it receives the parsed MQTT message payload and topic
```

## Architecture Specification

**Components:**

| Component | Purpose |
|-----------|---------|
| `src/server/mqtt.ts` | **New** — Top-level module. Exports `onFrigateMessage(topic, payload)` handler and `startMqttSubscriber()`. The handler is deliberately kept at the top level of `src/server/` for visibility and future extension. |
| `src/server/frigate/cache.ts` | Existing — `clearFrigateCache()` already exported |
| `package.json` | Add `mqtt` dependency |

**Design:**

- **`src/server/mqtt.ts`** is the single file. It contains:
  - `onFrigateMessage(topic: string, payload: Buffer)` — the handler, exported and visible. Currently calls `clearFrigateCache()`. Will be extended in future to parse the payload, dispatch to handlers by topic, push to SSE/WebSocket, etc.
  - `startMqttSubscriber()` — reads `MQTT_URL` from env. If unset, returns early. Otherwise creates an MQTT.js client, subscribes to `frigate/events` and `frigate/reviews`, wires `client.on('message', onFrigateMessage)`. Returns the client instance for graceful shutdown.
  - `SUBSCRIBED_TOPICS` — exported constant array of topic strings for testability.

- **Startup hook**: TanStack Start uses Nitro under the hood. A Nitro plugin at `server/plugins/mqtt.ts` (Nitro's plugin directory) calls `startMqttSubscriber()` on server init and stores the client for the `close` hook to disconnect gracefully.

- **MQTT.js configuration**:
  - Protocol: `mqtt://` (TCP, port 1883)
  - Credentials: from `MQTT_URL` (e.g., `mqtt://frigate:frigate@rabbitmq:1883`) or separate env vars
  - Reconnect: MQTT.js built-in auto-reconnect (default behavior)
  - Clean session: `true` (no persistent subscriptions needed)

**What is NOT in scope:**
- Parsing MQTT message payloads beyond topic identification
- Pushing events to connected clients (SSE/WebSocket) — future work
- Selective cache invalidation (we clear the entire cache; it's small and TTL-bounded)

**Constraints:**
- One new npm dependency: `mqtt` (MQTT.js v5)
- Handler must be a named, exported function at a discoverable location (`src/server/mqtt.ts`)
- No changes to the cache module — it already exports `clearFrigateCache()`

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 1 | MQTT connection | Server connects to RabbitMQ's MQTT plugin on startup when `MQTT_URL` is set |
| 2 | Topic subscription | Client subscribes to `frigate/events` and `frigate/reviews` |
| 3 | Cache cleared on event | Publishing a message to `frigate/events` causes `clearFrigateCache()` to execute |
| 4 | Cache cleared on review | Publishing a message to `frigate/reviews` causes `clearFrigateCache()` to execute |
| 5 | Graceful skip | No MQTT connection attempted when `MQTT_URL` is not set; no errors logged |
| 6 | Reconnect | MQTT.js auto-reconnect handles broker restarts without crashing the server |
| 7 | Handler visibility | `onFrigateMessage` is exported from `src/server/mqtt.ts` and callable independently |
| 8 | Graceful shutdown | MQTT client disconnects on server close |
| 9 | Tests pass | Unit tests cover: handler calls clearFrigateCache, startup with/without MQTT_URL, topic constants |
| 10 | Type safety | `tsc --noEmit` passes |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
