---
tags: [gotcha, css, tailwind]
created: 2026-10-24
---

# ⚠️ Unlayered CSS beats every Tailwind utility

> Any unlayered rule in `src/styles.css` wins over every layered rule, whatever
> its specificity. Put element rules in `@layer base` and component classes in
> `@layer components`.

## Context

Tailwind v4 emits its utilities inside `@layer utilities`. Rules written outside
any layer sit above all layers in the cascade. The Glassmorphism swap first put
`a { color: … }` at top level in `src/styles.css`.

## What we know / decided

- Utilities live in `@layer utilities`; `base` and `components` are layers too.
- An unlayered selector beats any layered rule, including a class utility such
  as `text-white` with higher specificity. Specificity is not consulted across
  the layer boundary.
- Element and base rules go in `@layer base`. Kept component classes
  (`.event-card`, `.nav-link`, …) go in `@layer components`, so a utility can
  still override them.
- Symptom seen: `<Button asChild><a>` rendered link-blue text on the blue
  primary fill. The `a` rule beat the button's `text-primary-foreground`.

## Why it matters

The failure is silent: the markup and classes look right, and the tests that
check class names still pass. Only a visual check shows it. When a utility
seems to be ignored, look for an unlayered rule in `src/styles.css` first.

Decision context: [[decisions/2026-10-24-glassmorphism-shadcn-design-system]].

## Related

- [[Home]]
- [[decisions/2026-10-24-glassmorphism-shadcn-design-system]]
