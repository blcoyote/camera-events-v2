---
tags: [decision, live, streaming, cross-platform, frigate, go2rtc, websocket]
created: 2026-07-19
---

# /live streams over MSE-fMP4 relayed through an app-proxied WebSocket

> The `/live` page uses a single transport: go2rtc's MSE WebSocket, relayed
> through an auth-gated same-origin `/api/live/:name/ws` and played by the
> vendored go2rtc `video-rtc.js` (`ManagedMediaSource` on iOS 17.1+). Frigate
> stays internal. Requires iOS 17.1+.

## Context

`/live` (one-camera-at-a-time live view) went through three transports in one
push, each rejected by the platform that matters most — **iOS Safari standalone
PWA**:

1. **MJPEG-in-`<img>`** — a review put its odds of actually working on iOS at
   ~15–35% (WebKit `multipart/x-mixed-replace` defects → frozen first frame).
2. **HLS (fMP4) proxied over plain HTTP** — reliable on iOS natively, kept
   Frigate internal, but ~3–10s latency and (for a true single transport) it
   still needed hls.js on non-Safari.

The user then pointed out Frigate's own UI renders live via a `<video>` with a
`blob:` src — i.e. **MSE** fed by fragmented-MP4 over go2rtc's WebSocket
(`/api/ws?src=NAME`), via the `video-rtc.js` web component. Two hard constraints
stood: **iOS must work** and there must be **one transport to maintain**.

## Decision

Stream **MSE (fragmented MP4) over go2rtc's WebSocket, relayed through the app**.

- **Server WS relay** (`src/features/live/server/live-mse-ws.ts`): a Nitro-level
  WebSocket route `GET /api/live/:name/ws`, registered in `vite.config.ts` via
  `nitro({ preset: 'bun', experimental: { websocket: true }, handlers: [...] })`
  (TanStack file routes cannot perform a WS upgrade). It uses crossws
  `createWebSocketProxy` to relay frames bidirectionally to the upstream
  `go2rtcMseWsUrl(name)` = `getGo2RtcBase()` with `http→ws` scheme swap +
  `/ws?src=NAME` (`src/features/live/server/mse-ws-url.ts`). go2rtc's internal
  port is unauthenticated, so no upstream credential is forwarded.
- **Auth on the upgrade**: the crossws `upgrade(request)` hook validates the
  camera name (`isValidCameraName`) and authenticates by unsealing the
  `google-sso` cookie **outside** TanStack's request context —
  `resolveIsAuthenticatedFromRequest` in `session.ts`, which calls h3's
  `unsealSession`/`mockEvent` with the same `SESSION_SECRET`. It `throw`s a
  `Response` (400/401) to abort before any upstream socket opens.
- **Client** (`src/features/live/components/LiveMsePlayer.tsx`): the **vendored**
  go2rtc `video-rtc.js` (`src/features/live/vendor/`, pinned to go2rtc v1.9.14,
  MIT) in `mode = 'mse'`, pointed at the same-origin `/api/live/:name/ws`. On
  iOS 17.1+ its MSE path uses `ManagedMediaSource` + `disableRemotePlayback`.
- Frigate stays internal — the browser only opens the same-origin WS; the app
  relays to go2rtc. Traefik forwards WS upgrades transparently. CSP already
  allows it (`connect-src 'self'` for the WS, `media-src 'self' blob:` for MSE).

Feasibility was de-risked with a runtime spike proving crossws
`createWebSocketProxy` + an auth-gated `upgrade` relays binary+text on this
repo's Bun/Nitro/crossws versions (with the unauth handshake rejected).

## Alternatives considered

- **MJPEG-in-`<img>`** — rejected: unreliable on iOS (frozen frame).
- **HLS (fMP4) over HTTP** — the prior implementation; rejected once MSE-over-WS
  proved feasible: MSE gives ~1s latency (vs HLS ~3–10s) and matches Frigate's
  own UI. HLS remains the natural fallback if we ever need to support iOS <17.1.
- **WebRTC (go2rtc)** — lowest latency and one code path everywhere, but its
  media is peer-to-peer: it needs go2rtc port 8555 published + public ICE
  `candidates`, breaking the "Frigate internal-only" posture. MSE rides the
  WebSocket, so it is fully proxyable — the deciding factor.

## Deviations & known limitations

- **iOS 17.1+ required.** Below 17.1 there is no MSE on iPhone; those users get
  no live view (accepted, in exchange for a true single transport). HLS is the
  documented fallback if that floor becomes a problem.
- **No `startstreaming`/`endstreaming` flow control.** Verified that go2rtc's
  `video-rtc.js` (all versions, incl. Frigate's fork) implements
  `ManagedMediaSource` + `disableRemotePlayback` but **not** the MMS
  flow-control events. This is the same code Frigate ships; accepted as a known
  upstream limitation. Watch for backgrounding/battery behaviour on real iOS; a
  reviewed follow-up could add flow-control handling.
- **Auth outside TanStack's session machinery.** The WS upgrade unseals the
  cookie directly via `h3-v2` (`unsealSession`) rather than `useSession()`,
  because the raw upgrade has no request-scoped async context. `h3-v2` is pinned
  in `package.json` (`npm:h3@2.0.1-rc.20`) to match the exact version
  `@tanstack/start-server-core` seals with — a coupling to keep in lockstep on
  TanStack upgrades (a round-trip test in `session.test.ts` guards it).
- **Vendored third-party client JS** (`video-rtc.js`) — reviewed, pinned, and
  excluded from lint/format; re-pin deliberately.

## Caveat (needs live verification)

Untestable from CI/mock (no real MSE/WebSocket/Frigate in jsdom). Before trusting
`/live`: (1) confirm the go2rtc WS path — `FRIGATE_GO2RTC_URL` overrides the
`${FRIGATE_URL}/live/webrtc/api` default if the Frigate version differs; (2) on a
real **iPhone 17.1+ standalone PWA**, confirm the `<video>` plays live and the WS
upgrade carries the `google-sso` cookie (no 401); (3) confirm the built
`.output/server/index.mjs` contains the crossws `handleUpgrade` branch (proves
`experimental.websocket` took effect).

## Why it matters

Live video is the sharpest edge of this project's cross-platform rule: the
"obvious" transports (MJPEG, plain MSE) each fail on iOS, the platform that can't
fail. MSE-over-WebSocket is the one option that is low-latency, matches Frigate's
proven approach, keeps every byte behind the app's cookie-gated proxy (no port
exposure), and is a single transport — at the cost of an iOS 17.1 floor.

## Related

- [[Home]]
- [[decisions/2026-04-17-cross-platform-pwa-first]]
- [[decisions/2026-04-14-frigate-api-client]]
- [[architecture/frigate-http-api]]
