# PWA, SSR & Tailwind

## Cross-Platform PWA

- **Cross-platform support is a top priority.** This app is a PWA that must work seamlessly on both iOS (Safari standalone) and Android (Chrome), as well as desktop browsers. Never ship a feature that only works on one platform — always test and account for both iOS and Android behavior differences.
- Every feature — including push notifications, service worker interactions, OAuth, and cookie-dependent API calls — must be implemented with cross-platform compatibility in mind.
- When you spot a platform-specific issue or limitation (e.g. an API not supported on iOS, cookie behavior differences in standalone mode, etc.), **do not silently fix it**. Flag it to me first, explain the issue and your proposed fix, and wait for confirmation before implementing.
- The service worker is built by `vite-plugin-sw.ts` (custom plugin) using Serwist. The SW source is `src/sw.ts`; push handler logic lives in `src/sw-push-handlers.ts`.

## SSR & Hydration

- This project uses TanStack Start with server-side rendering. All pages and components must produce identical HTML on server and client during the initial render.
- Never read browser-only globals (`window`, `navigator`, `document`, `Notification`, `PushManager`, `localStorage`, etc.) during render. These don't exist on the server and will cause hydration mismatches.
- Defer browser-only checks to `useEffect`. Use safe defaults (e.g. `false`, `'default'`, `null`) as initial state so the server and client agree on the first paint.
- When a component must branch on client-only state, render a neutral placeholder until a `useEffect` confirms the client has mounted, rather than conditionally rendering different content that the server can't predict.
- Use `useIsomorphicLayoutEffect` (alias `useLayoutEffect` on client, `useEffect` on server) for DOM-measurement effects — see `useCameraOrder.ts` for the pattern.

## Tailwind CSS

- Always use Tailwind CSS canonical class names instead of arbitrary value syntax when a built-in utility exists. For example, use `text-(--sea-ink)` instead of `text-[var(--sea-ink)]`, `min-h-11` instead of `min-h-[44px]`, `rounded-4xl` instead of `rounded-[2rem]`, `shrink-0` instead of `flex-shrink-0`.
- Design tokens are defined in `src/styles.css` under `@theme` and `:root`. The palette uses CSS custom properties: `--sea-ink`, `--sea-ink-soft`, `--lagoon`, `--lagoon-deep`, `--palm`, `--sand`, `--foam`, `--surface`, `--surface-strong`, `--line`, `--bg-base`, `--header-bg`, etc. Dark mode swaps are applied via `[data-theme='dark']` and `@media (prefers-color-scheme: dark)`.
- Fonts: `Manrope` (body, sans-serif), `Fraunces` (display headings).
- The theme is stored in `localStorage` under the key `'theme'` (`'light'`, `'dark'`, or `'auto'`). A blocking inline script in `__root.tsx` sets the `data-theme` attribute and class before paint to prevent FOUC.
