---
tags: [moc, home]
---

# 🏠 Home — Camera Events v2 Memory

The map of content for this project's long-term memory. See [[README]] for how
this vault is meant to be used.

> [!tip] Quick orientation
> Camera Events v2 is a self-hosted PWA for browsing [Frigate NVR](https://frigate.video/)
> events, delivering batched Web Push notifications over MQTT. TanStack Start (SSR),
> React 19, Tailwind v4, Bun runtime.

## 🧭 Start here

- [[architecture/system-overview]] — how the pieces fit together
- [[glossary]] — domain & project terms

## 🏛️ Architecture

- [[architecture/system-overview]]
- [[architecture/push-pipeline]]
- [[architecture/theming]] — token-driven; how to add swappable color themes
- [[architecture/frigate-http-api]] — full API surface; what we use vs. untapped

## 🧠 Decisions

- [[decisions/2026-04-14-frigate-api-client]] — one client + TTL cache + mock + validation gate
- [[decisions/2026-04-14-google-oauth-via-arctic]] — Arctic OAuth, encrypted session + state cookies
- [[decisions/2026-04-14-server-client-code-segmentation]] — server code under `*/server/`; no browser globals in render
- [[decisions/2026-04-14-server-function-authentication]] — every server fn calls `requireSession()` itself
- [[decisions/2026-04-15-feature-sliced-architecture]] — vertical slices, no cross-feature imports
- [[decisions/2026-04-15-mqtt-web-push-pipeline]] — per-camera batcher, silent VAPID gate
- [[decisions/2026-04-17-cross-platform-pwa-first]] — iOS/Android/desktop is a hard constraint
- [[decisions/2026-04-28-runtime-portable-sqlite-driver]] — dual Node/Bun driver behind one interface
- [[decisions/2026-06-29-obsidian-memory-vault]]
- [[decisions/2026-07-07-login-allowlist-in-google-cloud]] — allow-list lives in Google Cloud, not app code
- [[decisions/2026-07-19-live-hls-transport]] — /live streams over proxied HLS (fMP4), not MJPEG or WebRTC

## ⚠️ Gotchas

- [[gotchas/ssr-hydration-browser-globals]]
- [[gotchas/never-run-tsr-generate]]

## 📌 Conventions reminders

- `bd` for issues, this vault for durable knowledge (see [[README]]).
- One idea per note. Link with `[[wikilinks]]`.
