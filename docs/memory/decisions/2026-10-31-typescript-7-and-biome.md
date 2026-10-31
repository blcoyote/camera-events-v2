---
tags: [decision, tooling, typescript, lint, format]
created: 2026-10-31
---

# TypeScript 7 with Biome for linting and formatting

> The project type-checks with TypeScript 7 (the native Go compiler). Biome
> (`biome.json`) lints and formats. ESLint, `@tanstack/eslint-config` and
> Prettier are gone.

## Context

TypeScript 7.0 shipped as `latest` on npm. The only thing holding the project on
6.x was `typescript-eslint` (pulled in by `@tanstack/eslint-config`): it pins
`typescript >=4.8.4 <6.1.0`, canary included, because it is built on the
TypeScript 5/6 JavaScript compiler API that TS 7 does not ship.

## Decision

- `typescript@^7` provides `tsc`; `tsc --noEmit` (pre-push and CI) is unchanged.
- **Lint:** Biome with `preset: "none"`, enabling exactly the rules the TanStack
  ESLint config enforced (minus the ones we had turned off), mapped to Biome
  names. `bun run lint` = `biome lint .`.
- **Format:** Biome formatter with the old Prettier settings: single quotes
  (JS, CSS, YAML), no semicolons, trailing commas, width 80. JSON stays
  unformatted, as `.prettierignore` had it. `bun run format` = `biome format .`.
- `bun run check` and lint-staged run `biome check --write` (format + lint fixes).
  Assist (import sorting) is off; we never sorted imports.

### Rules not carried over

- No Biome equivalent: `no-for-in-array`, `no-unnecessary-type-assertion`,
  `triple-slash-reference`, `import/no-duplicates`, type-parameter
  `naming-convention`, `@stylistic/spaced-comment`,
  `import/newline-after-import`. `no-octal`, `no-delete-var` and
  `no-invalid-regexp` are parse errors in Biome anyway.
- `noUnnecessaryConditions` (Biome's `no-unnecessary-condition`) is **off**: its
  type inference treats `useRef(x).current` as constant and flags every ref
  check. Re-enable when Biome fixes that.
- `noInferrableTypes` has no `ignoreParameters` option, so defaulted parameters
  drop their redundant annotation (`download = false`).
- **Markdown is not formatted.** Biome 2.6's Markdown formatter inserts a blank
  line inside YAML frontmatter, which breaks every vault note. Re-enable
  `markdown.formatter` once that is fixed.

## Alternatives

- **Stay on TS 6 until `typescript-eslint` supports TS 7** — no date; blocks the
  ~7× faster type check.
- **Oxlint + `oxlint-tsgolint`** — tried first on this branch. Closer rule
  parity (keeps true type-aware rules via tsgo), but it is a second tool next to
  the formatter. Chosen against in favour of one tool and one config.
- **Keep Prettier** next to the linter — Biome formats the same languages we use
  apart from Markdown.

## Why it matters

Type-check went from ~7 s to ~1 s and lint + format from ~15 s to well under a
second, which makes the pre-push gate cheap. Biome's type-aware rules use its
own inference, not the compiler, so they are weaker than `typescript-eslint`'s;
`tsc` strict mode is the real type gate.
