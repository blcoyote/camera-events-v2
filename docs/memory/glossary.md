---
tags: [glossary]
created: 2026-06-29
---

# Glossary

Domain and project-specific terms. Link to this note from anywhere a term first
appears.

- **Frigate** — the [open-source NVR](https://frigate.video/) (network video
  recorder) this app is a companion to. Source of cameras, events, clips,
  snapshots. Reached via `FRIGATE_URL`.
- **Event** — a Frigate-detected motion occurrence (e.g. a `person` on
  `front_porch`). Has an id, camera, label, start time. Browsed in the app and
  the trigger for push notifications.
- **Review** — Frigate's higher-level grouping of events (`frigate/reviews` MQTT
  topic). Used here for cache invalidation and the dashboard's alert/detection
  counts.
- **Severity (alert / detection)** — a Review's importance level. `alert` =
  noteworthy (e.g. a person), `detection` = lower-priority motion. Surfaced as
  the dashboard's "Alerts 24h" / "Detections 24h" tiles.
- **Event summary** — `GET /api/events/summary`: per camera/label/day event
  _counts_ (not full events). Powers the dashboard's bar lists.
- **Stats** — `GET /api/stats`: live Frigate health (per-camera FPS, detector
  inference speed, storage in **MB**, uptime, version). Powers the dashboard's
  system-health card. See [[architecture/dashboard]].
- **Event batching** — collapsing a burst of events per camera into one push
  within `EVENT_BATCH_WINDOW_MS` (default 30s). See [[architecture/push-pipeline]].
- **VAPID** — the key pair authenticating Web Push. Push is silently off if any
  VAPID env var is missing.
- **Standalone (iOS)** — a PWA launched from the iOS home screen. Has distinct
  cookie / service-worker behavior that cross-platform features must account for.
- **Feature slice** — a self-contained folder under `src/features/` owning all of
  its code. Slices never import from each other; shared code lives in
  `src/features/shared/`.
- **Server function** — a `createServerFn` handler. Directly callable over HTTP at
  `/_serverFn/{hash}`, so each must call `requireSession()` itself.

## Related

- [[Home]]
- [[architecture/system-overview]]
