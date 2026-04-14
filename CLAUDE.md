# Project Instructions

## Tailwind CSS

- Always use Tailwind CSS canonical class names instead of arbitrary value syntax when a built-in utility exists. For example, use `text-(--sea-ink)` instead of `text-[var(--sea-ink)]`, `min-h-11` instead of `min-h-[44px]`, `rounded-4xl` instead of `rounded-[2rem]`, `shrink-0` instead of `flex-shrink-0`.

## Route Generation

- **NEVER run `npx tsr generate`**. The `tsr` npm package is an unrelated unused-code removal tool that will **delete** test files, story files, Storybook config, and `vite.config.ts`. Running it with `--write` is destructive and irreversible without git.
- Route tree generation (`src/routeTree.gen.ts`) is handled automatically by the `tanstackStart()` Vite plugin during `pnpm dev` and `pnpm build`. No separate CLI step is needed.
- If you add a new route file under `src/routes/`, start the dev server (`pnpm dev`) to trigger route tree regeneration.
