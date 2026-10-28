---
paths:
  - 'src/**/*.tsx'
  - 'src/**/*.css'
---

# Tailwind & design system

- Use canonical Tailwind class names over arbitrary values when a utility exists: `text-foreground` not `text-[var(--gl-fg)]`, `min-h-11` not `min-h-[44px]`, `rounded-4xl` not `rounded-[2rem]`, `shrink-0` not `flex-shrink-0`.
- Design system is **Glassmorphism**, light and dark (`.dark` on `<html>` overrides `--gl-*` in `:root.dark`). Source `docs/design-system/glassmorphism/`; specs `docs/specs/glassmorphism-design-system.md`, `docs/specs/glassmorphism-dark-mode.md`; decision `docs/memory/decisions/2026-10-24-glassmorphism-shadcn-design-system.md`.
- Tokens are layered: `--gl-*` primitives in `src/styles.css` `:root` → shadcn semantic vars → Tailwind `@theme inline`. Use semantic utilities: `bg-background`, `bg-card`, `text-foreground`, `text-fg-2`, `text-muted-foreground`, `text-brand`, `text-brand-strong`, `bg-surface-warm`, `bg-surface-hover`, `border-border`, `border-border-soft`, `success|warn|danger` (+ `-text`), `glass`, `glass-flat`, `glass-strong`, `eyebrow`, `rounded-input|card|hero`, `shadow-raised`, `leading-display`.
- **Never** use raw hex, raw colour-scale values (`red-500`, `emerald-600`), or `dark:` variants. `src/styles.legacy-tokens.test.ts` bans legacy token names.
- Every new colour primitive in `src/styles.css` needs a `:root.dark` value; fills and text use separate tokens (`--gl-accent-fill` vs `--gl-accent-strong`).
- Font is Inter (`font-sans`).
- Element rules go in `@layer base`, component classes in `@layer components`. **Never add unlayered rules to `src/styles.css`** — they override every utility (`docs/memory/gotchas/unlayered-css-beats-tailwind-utilities.md`).
- shadcn/ui primitives live in `src/features/shared/components/ui/`; `cn()` is `src/features/shared/utils/cn.ts`; `components.json` at root. If the shadcn CLI can't reach its registry, hand-write from the new-york style using the unified `radix-ui` package.
