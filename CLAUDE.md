# Project Instructions

## Tailwind CSS

- Always use Tailwind CSS canonical class names instead of arbitrary value syntax when a built-in utility exists. For example, use `text-(--sea-ink)` instead of `text-[var(--sea-ink)]`, `min-h-11` instead of `min-h-[44px]`, `rounded-4xl` instead of `rounded-[2rem]`, `shrink-0` instead of `flex-shrink-0`.

## Route Generation

- **NEVER run `npx tsr generate`**. The `tsr` npm package is an unrelated unused-code removal tool that will **delete** test files, story files, Storybook config, and `vite.config.ts`. Running it with `--write` is destructive and irreversible without git.
- Route tree generation (`src/routeTree.gen.ts`) is handled automatically by the `tanstackStart()` Vite plugin during `pnpm dev` and `pnpm build`. No separate CLI step is needed.
- If you add a new route file under `src/routes/`, start the dev server (`pnpm dev`) to trigger route tree regeneration.

## Feature-Sliced Architecture

- The codebase uses a vertical feature-slice architecture. Each feature lives in its own folder under `src/features/` and owns all of its components, hooks, utilities, types, and server logic.
- **Features must never import from other features.** No cross-feature imports are allowed — if two features need the same logic, it belongs in `src/features/shared/`.
- `src/features/shared/` is the only place for code that is used by multiple features. Shared code should be genuinely reusable, not a dumping ground for convenience.
- When creating a new feature, give it its own folder under `src/features/` with everything it needs. Prefer duplication over coupling between features.

## SSR & Hydration

- This project uses TanStack Start with server-side rendering. All pages and components must produce identical HTML on server and client during the initial render.
- Never read browser-only globals (`window`, `navigator`, `document`, `Notification`, `PushManager`, `localStorage`, etc.) during render. These don't exist on the server and will cause hydration mismatches.
- Defer browser-only checks to `useEffect`. Use safe defaults (e.g. `false`, `'default'`, `null`) as initial state so the server and client agree on the first paint.
- When a component must branch on client-only state, render a neutral placeholder until a `useEffect` confirms the client has mounted, rather than conditionally rendering different content that the server can't predict.
