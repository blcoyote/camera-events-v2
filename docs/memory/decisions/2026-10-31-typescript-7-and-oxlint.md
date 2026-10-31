---
tags: [decision, tooling, typescript, lint]
created: 2026-10-31
---

# TypeScript 7 with Oxlint instead of ESLint

> The project type-checks with TypeScript 7 (the native Go compiler) and lints
> with Oxlint in type-aware mode. ESLint and `@tanstack/eslint-config` are gone.

## Context

TypeScript 7.0 shipped as `latest` on npm. The only thing holding the project on
6.x was `typescript-eslint` (pulled in by `@tanstack/eslint-config`): it pins
`typescript >=4.8.4 <6.1.0`, canary included, because it is built on the
TypeScript 5/6 JavaScript compiler API that TS 7 does not ship. Our config used
type-aware rules, so dropping type information was not an option.

## Decision

- `typescript@^7` provides `tsc`; `tsc --noEmit` (pre-push and CI) is unchanged.
- `oxlint` + `oxlint-tsgolint` replace ESLint. `.oxlintrc.json` enables exactly
  the rules the TanStack config enforced (minus the ones we had turned off),
  with `options.typeAware: true` and the default `correctness` category off, so
  the rule set did not silently grow.
- Not carried over: `no-octal` (a syntax error in ES modules anyway),
  `@typescript-eslint/naming-convention` (type-parameter `T`/`TFoo` naming),
  `@stylistic/spaced-comment` and `import/newline-after-import` (no Oxlint
  equivalent; cosmetic).
- Oxlint caught four things ESLint missed (`(x?.[1] as T).body` in tests, a
  `let` in a `.mjs` script); they were fixed in the same change.

## Alternatives

- **Stay on TS 6 until `typescript-eslint` supports TS 7** — no date; blocks the
  ~7× faster type check.
- **Biome** — also independent of the TS JS API, but its own rule names and type
  inference make the port bigger, and it wants to own formatting (we keep
  Prettier).

## Why it matters

Type-check went from ~7 s to ~1 s and lint from ~10 s to ~2 s, which makes the
pre-push gate cheap. Oxlint's extra `correctness` and type-aware rules (e.g.
`no-floating-promises`) are available if we later want a stricter gate; they
currently flag ~35 warnings and are deliberately off.
