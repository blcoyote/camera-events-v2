---
tags: [gotcha, ssr, react]
created: 2026-06-29
---

# ⚠️ No browser globals during render (SSR hydration)

> Reading `window`/`navigator`/`Notification` during render breaks hydration.

## What bites

This is SSR (TanStack Start). The initial render runs on the **server**, where
`window`, `navigator`, `document`, `Notification`, `PushManager`, and
`localStorage` don't exist. Touching them during render either crashes SSR or
produces server/client HTML mismatch → hydration error.

## The rule

- Use safe defaults as initial state (`false`, `'default'`, `null`) so server and
  client agree on first paint.
- Defer browser-only checks to `useEffect`.
- When a component must branch on client-only state, render a neutral placeholder
  until a `useEffect` confirms mount.
- For DOM-measurement effects, use `useIsomorphicLayoutEffect` — see
  `useCameraOrder.ts` for the established pattern.

## Why it matters

Hydration mismatches are easy to introduce and produce confusing, intermittent
failures. The theme toggle dodges this with a blocking inline script in
`__root.tsx` that sets `data-theme` before paint.

## Related

- [[architecture/system-overview]]
- [[Home]]
