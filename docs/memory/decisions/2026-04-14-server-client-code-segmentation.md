---
tags: [decision, architecture, ssr]
created: 2026-04-14
---

# Server-only code is isolated under `*/server/`; components never read browser globals during render

> TanStack Start SSR means every module can run on both server and client —
> the codebase draws the line explicitly instead of hoping it holds.

## Context

TanStack Start server-renders every route. A module written without SSR in
mind fails in one of two directions: server-only code (DB handles, session
secrets, the Frigate client) gets pulled into a client-reachable import graph
and ships in the browser bundle, or client-only code reads a browser global
during the server render pass and either crashes SSR or produces server/client
HTML that don't match.

## Decision

- Server-only code lives under a `server/` folder inside its owning feature
  (`src/features/shared/server/frigate/client.ts`, `.../server/session.ts`,
  `src/features/auth/server/auth.ts`, `src/features/push-notifications/server/push-store.ts`,
  etc.) and must never be imported from a component or hook that's reachable
  from the client bundle.
- Components/hooks never read `window`, `navigator`, `document`,
  `Notification`, `PushManager`, or `localStorage` during render. Initial
  state uses SSR-safe defaults (`false`, `'default'`, `null`) so server and
  client agree on first paint; the actual browser check happens in
  `useEffect`. Where a component must branch on client-only state, it renders
  a neutral placeholder until an effect confirms the client has mounted.
- DOM-measurement effects use `useIsomorphicLayoutEffect` (`useLayoutEffect`
  on the client, `useEffect` on the server — picked via `typeof window !==
'undefined'`) rather than a bare `useLayoutEffect`, which warns/no-ops during
  SSR. See `src/features/cameras/hooks/useCameraOrder.ts:17-18`.
- The one sanctioned exception is a **blocking inline `<script>`** in
  `src/routes/__root.tsx`, which reads `localStorage`/`matchMedia` before
  paint to set the theme/palette class and avoid a flash of the wrong theme.
  It's plain script text injected via `dangerouslySetInnerHTML`, not React
  render code, so it sits outside the SSR render path entirely.
- The `tanstack-start-boundaries` skill is the enforcement mechanism: it's
  invoked before writing or reviewing any `createServerFn`, route `loader`,
  new file under `*/server/`, or component/hook touching a browser API.

## Why it matters

Both failure modes are silent until they aren't: a leaked server import
bloats or exposes secrets in the client bundle with no build error to catch
it, and a stray `window` read during render either takes down SSR or produces
a hydration mismatch that only shows up as an intermittent console warning in
production. Drawing the boundary at the folder level (`server/`) and the
lifecycle level (`useEffect`, not render) makes both mistakes visible as an
import-path or a lint pattern instead of a runtime surprise.

## Related

- [[Home]]
- [[gotchas/ssr-hydration-browser-globals]] — the specific hydration failure
  mode this decision prevents
- [[decisions/2026-04-15-feature-sliced-architecture]] — `server/` sits inside
  the same feature-slice boundary, not a separate top-level layer
- [[gotchas/never-run-tsr-generate]]
