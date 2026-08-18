---
tags: [decision, push-notifications, mqtt, frigate]
created: 2026-08-18
---

# Detect camera offline/online via frigate/stats and frigate/available, not polling

> Camera health is derived from the same MQTT connection already used for
> motion events — `frigate/stats` (periodic per-camera `camera_fps`, debounced
> to 2 consecutive zero readings) and `frigate/available` (Frigate's own LWT,
> undebounced). No new connection, no server-side polling, no schema change.

## Context

Frigate NVR (0.13) has no dedicated per-camera "online/offline" MQTT topic —
confirmed against Frigate's own MQTT integration docs and its `/api/stats`
response shape (already modelled in this codebase as `FrigateStats` in
`src/features/shared/server/frigate/types.ts`). The Frigate web UI's "No
frames have been received" black tile is a client-side inference from
`camera_fps` reaching zero; it's never published as a discrete event.

Two real signals exist, both already reachable without adding new
infrastructure:

- `frigate/stats` mirrors `/api/stats` and is published periodically (Frigate's
  own `stats_interval` config, default 60s) with per-camera `camera_fps`.
- `frigate/available` is Frigate's MQTT Last Will and Testament — a
  `"online"`/`"offline"` string for the whole instance, delivered reliably and
  immediately on broker disconnect (unlike a stats reading, this needs no
  debounce).

This app already holds one MQTT connection open (`src/features/push-notifications/server/mqtt.ts`)
for `frigate/events`/`frigate/reviews`. Every other data flow in this codebase
is MQTT-push-driven — there is no server-side polling anywhere (`setInterval`
does not appear once outside client-side live-view refresh). Introducing
interval-based polling of `/api/stats` to detect camera health would have been
the first such mechanism in the codebase, for data Frigate already pushes to a
connection that's open anyway.

## Decision

- **Subscribe to `frigate/stats` and `frigate/available` on the existing MQTT
  client**, alongside the existing two topics.
- **A new `CameraAvailabilityTracker` class** (`camera-availability.ts`) owns
  per-camera debounce state, structurally parallel to `EventBatcher`: it takes
  its config (`offlineThreshold`, default 2) as a constructor argument rather
  than reading `process.env` itself, and knows nothing about MQTT — `mqtt.ts`
  owns topic parsing and env resolution, keeping the tracker a pure,
  independently-testable state machine.
  - `camera_fps === 0` for `offlineThreshold` **consecutive** `frigate/stats`
    readings → offline. A single zero reading is noise (Frigate cameras
    routinely report a stray 0.0 on some restarts/reconnects); requiring two
    consecutive readings (~2 minutes at the default interval) filters that
    without meaningfully delaying real outage detection.
  - `frigate/available: "offline"` → every known camera flagged offline
    **immediately**, no debounce — this is a different, stronger signal
    (Frigate itself is gone), not a per-camera fps blip.
  - `frigate/available: "online"` fires no transition on its own. Recovery is
    only reported once an actual `frigate/stats` reading confirms a camera's
    `camera_fps` is nonzero — Frigate's process restarting doesn't mean the
    camera streams have resumed yet.
- **A separate dispatcher, `notifyUsersForCameraAvailability`**, not a reuse of
  `notifyUsersForCamera`/`EventBatcher`. Availability changes are rare, binary,
  important state transitions — the existing motion pipeline's entire
  raison d'être (burst detection, leading-edge flush, Apple-endpoint pacing)
  solves a problem (a _stream_ of events needing throttling) that doesn't
  exist here. Forcing this through `EventBatcher` would mean inventing a fake
  `FrigateEventInfo` (what `label` does an offline camera have?) for no gain.
- **One global, opt-in preference**, default off, stored in the existing
  `push_notification_preferences` table as `category = 'camera_availability'`,
  `resource_id = 'global'` — a fixed non-null sentinel, deliberately not
  `NULL`. SQLite's `UNIQUE` index treats every `NULL` as distinct from every
  other `NULL`, so a `NULL` `resource_id` would silently defeat the
  `ON CONFLICT(user_id, category, resource_id)` upsert and create a new
  duplicate row on every toggle instead of updating one — caught by a
  regression test in `push-store.test.ts` before it could ship.
- **In-memory tracker state, no durable/restart-safe tracking** — consistent
  with `EventBatcher` and `SendThrottle`'s existing precedent (see
  [[2026-04-15-mqtt-web-push-pipeline]] and
  [[2026-08-02-alert-once-per-burst-then-patch]], both of which explicitly
  reasoned against durable state for the same class of problem). A restart
  mid-outage costs at most `offlineThreshold` extra readings before an
  already-known outage is re-flagged; deemed not worth a persistence layer.

## Alternatives

- **Poll `/api/stats` on a `setInterval`.** Rejected — would be the first
  server-side polling mechanism in the codebase, duplicating data Frigate
  already pushes to a connection already open.
- **Per-camera opt-out for availability alerts**, mirroring the motion-event
  preference shape. Rejected for this iteration — the requirement was a
  single settings switch, default off. The `category`/`resource_id` schema
  already generalizes to a per-camera variant later without a migration.
- **Route through `EventBatcher`/`notifyUsersForCamera`.** Rejected — see
  above; wrong shape for a binary rare event, not a throttled stream.

## Why it matters

Any future "is this camera actually healthy" feature (a dashboard indicator,
an HA-style sensor, a stricter alerting policy) should read `camera_fps` via
`frigate/stats` the same way rather than re-deriving health from `/api/stats`
polling or inventing a third signal — the debounced-fps-plus-LWT pattern here
is the intended long-term primitive for "is this camera up." If a future
change needs per-camera opt-out for these alerts, extend the existing
`category = 'camera_availability'` rows with a real `resource_id` (the camera
name) rather than introducing a new preference concept.
