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
- [[glossary]] — tooling terms; domain terms in [CONTEXT.md](../CONTEXT.md)

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
- [[decisions/2026-07-29-session-lifetime-and-proactive-refresh]] — 30-day rolling session, client-visible `expiresAt`, proactive reload
- [[decisions/2026-08-02-alert-once-per-burst-then-patch]] — one alert per activity burst, silent in-place patching after
- [[decisions/2026-08-18-camera-availability-detection]] — camera offline/online via frigate/stats + frigate/available, no polling
- [[decisions/2026-08-29-ghost-event-notifications]] — gate the notification deep link on Frigate's own persistence flags, not the push
- [[decisions/2026-09-21-users-table-and-admin-flag]] — users table keyed by Google `sub`; `is_admin` fails closed, seeded one-way from `ADMIN_EMAILS`
- [[decisions/2026-10-13-app-owned-session-cookie]] — sessions sealed by the app via `iron-webcrypto`, byte-compatible with the old h3 cookies; absolute expiry, rotation at sign-in, no cookie for anonymous visitors
- [[decisions/2026-09-21-admin-global-notification-mute]] — admin silences all push for a chosen duration (10 minutes to 6 hours); deadline in SQLite, enforced at dispatch
- [[decisions/2026-10-14-delivery-module]] — one Delivery module owns Mute, fan-out and send; a Burst Alert swallowed by Mute is promoted on the first unmuted flush
- [[decisions/2026-10-17-single-glossary-and-vocabulary]] — CONTEXT.md is the only domain glossary; Ghost, Alert, Availability, Device, Favorite and Patch-count vocabulary settled
- [[decisions/2026-10-24-glassmorphism-shadcn-design-system]] — Glassmorphism tokens (`--gl-*`) → shadcn semantic vars → Tailwind; light only, Radix overlays, iOS status bar `default`

## ⚠️ Gotchas

- [[gotchas/ssr-hydration-browser-globals]]
- [[gotchas/never-run-tsr-generate]]
- [[gotchas/ios-ignores-silent-and-renotify]]
- [[gotchas/bd-unavailable-in-claude-containers]] — check `which bd` before
  trusting the issue-tracking workflow
- [[gotchas/frigate-publishes-new-before-persisting]] — the `"new"` MQTT message
  arrives before (and sometimes instead of) the event row

## 🧪 Conventions

- [[conventions/test-quality-heuristics]] — 8-question checklist for whether a
  test earns its keep, with good/bad examples from a full-suite audit
- [[fallback-tasks/README]] — plain-markdown issue tracking for when `bd` isn't
  installed (ephemeral, not durable knowledge — see the note itself)

## 📌 Conventions reminders

- `bd` for issues, this vault for durable knowledge (see [[README]]).
- One idea per note. Link with `[[wikilinks]]`.
