---
tags: [decision, live, streaming, cross-platform, frigate, go2rtc]
created: 2026-07-19
---

# /live streams over HLS (fMP4) proxied through the app — not MJPEG, not WebRTC

> The `/live` page uses a single transport: go2rtc HLS (fMP4/CMAF) fetched and
> rewritten by an auth-guarded app proxy, played by native `<video>` on
> iOS/Safari and by `hls.js` everywhere else. Frigate/go2rtc stay internal.

## Context

The `/live` page (one-camera-at-a-time live view) first shipped with an MJPEG
transport: Frigate's `GET /api/{camera}` (`multipart/x-mixed-replace`) proxied
through the app and rendered in an `<img>`. A skeptical review put the odds of
that actually working on **iOS Safari standalone PWA** — the project's
top-priority platform (see [[decisions/2026-04-17-cross-platform-pwa-first]]) —
at only ~15–35%: WebKit has long-standing `multipart/x-mixed-replace` defects
(frozen first frame), and `<img>`-based MJPEG can't carry the auth affordances a
`fetch` can. MJPEG is solid on Android/desktop but wrong for the platform that
matters most here.

Two hard constraints drove the redesign: **iOS must work**, and there must be a
**single transport** to maintain (no per-platform hybrid). That eliminates
MJPEG and leaves HLS or WebRTC — the only transports that work on iOS _and_
everywhere else.

## Decision

Replace MJPEG entirely with **HLS (fMP4/CMAF), proxied through the app**.

- The app fetches go2rtc's media playlist at
  `${FRIGATE_GO2RTC_URL || FRIGATE_URL + '/live/webrtc/api'}/stream.m3u8?src=NAME&mp4`
  (`getGo2RtcBase()` / `getCameraHlsPlaylist` in
  `src/features/shared/server/frigate/client.ts`). The `&mp4` flag selects
  fMP4/CMAF, the variant Safari's native player accepts.
- `rewriteHlsPlaylist` (`src/features/live/utils/`) rewrites every segment and
  `URI="..."` reference in the playlist to
  `/api/live/${camera}/segment?ref=${encodeURIComponent(ref)}`, so all media
  flows back through the app.
- Two auth-guarded routes: `GET /api/live/:name/stream` (rewritten playlist) and
  `GET /api/live/:name/segment?ref=...` (streamed segment, Range-forwarding),
  handled by `handleHlsPlaylistRequest` / `handleHlsSegmentRequest`
  (`src/features/live/server/live-hls-proxy.ts`). Both call
  `resolveIsAuthenticated()`, validate the camera with `isValidCameraName`, and
  the segment `ref` with `isValidHlsSegmentRef` (an SSRF/traversal guard:
  deny-list `://`, `..`, `\`, leading `/`, control chars, whitespace, `@` +
  allow-list regex). This reuses the proven clip-proxy streaming pattern.
- Client (`LiveCameraView.tsx`): `<video playsInline muted autoPlay controls>`
  pointed at `/api/live/:name/stream`. If
  `video.canPlayType('application/vnd.apple.mpegurl')` is truthy (iOS/Safari) it
  sets `video.src` directly (native HLS); otherwise it dynamically
  `import('hls.js')` and attaches. One transport, one endpoint; the only branch
  is native-vs-hls.js at the player, not a second wire protocol.

Everything reaches Frigate only via the existing internal `FRIGATE_URL` proxy —
**no new exposed ports**, cookie auth preserved. CSP gained `media-src 'self'
blob:` (both compose files) because hls.js assigns a `blob:` MediaSource URL to
the `<video>`.

## Alternatives considered

- **MJPEG-in-`<img>`** (the original) — rejected: unreliable on iOS standalone
  (frozen frame), and violates the single-transport requirement once a working
  iOS path has to be added alongside it.
- **WebRTC (go2rtc)** — best latency (<1s) and one identical code path on all
  platforms, and it's what Frigate's own UI uses for iOS. Rejected here because
  WebRTC **media is peer-to-peer** and does not traverse the app proxy: it
  requires publishing go2rtc's port 8555 and configuring public ICE
  `candidates`, a deliberate break of the "Frigate internal-only" posture plus
  host infra changes. Kept as the documented upgrade path if sub-second latency
  is ever worth relaxing the security model.
- **MSE / ManagedMediaSource over a proxied WebSocket** — same-origin-friendly
  and low-latency, but iOS-17.1-gated and prone to fallback, so it can't be the
  sole transport. Viable only as an enhancement tier layered on an HLS baseline.
- **Progressive `/api/stream.mp4`** — not a real live path on iOS (Safari
  redirects to HLS anyway).

## Deviation from the plan

The feature's first implementation (and the initial plan) was MJPEG. This ADR
records the current, shipped reality: HLS. The MJPEG client function, proxy
handler, and `<img>` view were removed outright so exactly one transport
remains.

## Caveat (needs live verification)

The go2rtc HLS path prefix (`/live/webrtc/api`) has drifted across Frigate
versions, so it is configurable via `FRIGATE_GO2RTC_URL`. It cannot be verified
from CI/mock mode. Before trusting `/live` in production: (1) confirm
`curl "$FRIGATE_URL/live/webrtc/api/stream.m3u8?src=<cam>&mp4"` returns a
playlist (adjust `FRIGATE_GO2RTC_URL` if not), and (2) on a real iPhone
standalone PWA confirm the `<video>` plays live for 60s+ and the
playlist/segment requests carry the `google-sso` cookie (no 401). Mocks cover
the wiring, not real playback.

## Why it matters

Live video transport is the sharpest instance of the cross-platform constraint:
the "obvious" choice (MJPEG) is the one that fails on the one platform that
can't fail. HLS trades latency (~3–10s) for reliability on iOS and for keeping
the entire media path behind the app's cookie-guarded proxy — no port exposure,
no per-platform transport fork. The WebRTC alternative is real but is a security
posture change that must go through human sign-off, not a silent swap.

## Related

- [[Home]]
- [[decisions/2026-04-17-cross-platform-pwa-first]]
- [[architecture/frigate-http-api]]
- [[decisions/2026-04-14-frigate-api-client]]
