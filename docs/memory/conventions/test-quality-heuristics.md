---
tags: [convention, testing]
created: 2026-08-18
---

# Test quality heuristics — fewer, better tests

> Before writing or keeping a test, run it through the checklist below. Grounded in
> a full read-through audit of all 87 test files / ~958 tests in this repo
> (2026-08-18) — every example cited actually exists in this codebase.

## Context

Asked to critically judge whether ~958 tests across this codebase individually earn
their keep. Twelve parallel agents read every test file in full, alongside its
source, and judged each `it()` block against whether it would actually catch a real
regression. Net finding: **the median test in this repo is good** — CLAUDE.md's
TDD discipline and "exhaustive coverage for security/correctness-critical logic"
policy are visibly working, especially in pure validators, timing/race-condition
logic, and SSRF/auth guards. But a substantial minority is padding, and a smaller,
more dangerous set actively tests nothing (or tests a hand-copied reimplementation
instead of the real code). This note is the standing rule for telling the two
apart, so future test-writing (mine or a delegated Sonnet subagent's) produces
fewer, sharper tests instead of inflating the count.

## What we know / decided

### The rule: 8 questions before a test earns its place

1. **Does it call the real subject?** Import and invoke the actual function/hook/
   component — never hand-copy its logic into the test and assert the copy is
   internally consistent. That isn't a weak test, it's a **false one**: it stays
   green through a real regression. Worst offenders found: `useRefetchOnFocus.test.ts`
   (never imports `useRefetchOnFocus`, reimplements the throttle logic inline across
   all 4 tests); `usePushSubscription.test.ts` (14 of 20 tests never call the hook —
   including hand-copying the Brave-detection `AbortError` workaround and asserting
   it against itself); `NotificationSettings.test.ts` (0 of 4 tests import the
   component at all).
2. **Mutation gut-check: if I broke the one line this test is named for, would it
   fail?** If flipping a `&gt;` to `&gt;=`, deleting the guard, or removing the call
   entirely wouldn't turn this test red, it isn't testing that behavior. Caught
   `mqtt.test.ts`'s log-string tests (assert `console.log` text, never that
   `eventBatcher.add` was actually called) and `favorites-fns.test.ts`'s
   `"calls getEvent for all IDs in parallel"` (would pass identically for a
   sequential `for` loop).
3. **Is this the first test to reach this branch, or the Nth with a different
   literal?** A second camera name, event ID, or push-endpoint host testing the
   exact same `if` is not a new edge case. Keep the Nth input only when it crosses
   a real boundary: type coercion (`0` vs `undefined` vs `'0'`), sign flip, off-by-
   one, empty/null/undefined treated differently. Recurring low-value pattern
   across nearly every batch (e.g. `client.test.ts`'s repeated "ok:false on HTTP
   error" re-tested per endpoint; `camera-availability.test.ts` testing the same
   `typeof fps === 'number'` guard three times with `'n/a'`/`undefined`/`null`).
4. **Am I asserting the real observable, or a proxy for it?** Prefer return value /
   rendered DOM the user sees / a side effect that did-or-didn't happen. Distrust:
   CSS-class-substring checks (`NavDrawer.test.tsx`'s `backdrop-blur` class match,
   `FavoriteButton.test.tsx`'s `/p-/` regex "44px touch target" check that any
   padding class would satisfy), DOM-position checks (`CameraEventDetailPage.test.tsx`'s
   `compareDocumentPosition` order test), and "mock was called" with no argument
   check when the real assertion (return value, state, DOM) was available.
5. **Is the code under test still reachable from the app?** Grep for callers before
   defending a function with tests. Found two entire dead-code test files:
   `boundingBox.test.ts` (`isNonZeroBox` has zero callers in `src/`) and
   `mock-events.test.ts` (`PLACEHOLDER_EVENTS`/`findEventById`, superseded by the
   real Frigate-backed list). `bun run knip` should catch these — run it before
   trusting a test file's continued existence.
6. **Is the exhaustiveness deliberate, or just volume?** Full branch/input
   enumeration is _correct_, not padding, when the logic is a security boundary,
   a timing/race condition, or has genuinely independent branches — e.g.
   `test-auth-guard.test.ts`'s case-sensitivity + truthy-coercion checks on a
   prod-auth-bypass gate, `event-batcher.test.ts`'s burst-gap-vs-window boundary
   pairs, `send-throttle.test.ts`'s Apple-host exact-match (not suffix) check,
   `serializeForScript.test.ts`'s U+2028/U+2029 escaping. It is padding when a
   function has no real branching and every "case" collapses to the same code
   path — e.g. constant-equals-itself tests (`SESSION_COOKIE_NAME`, `CACHE_TTL_MS`,
   `OAUTH_SCOPES`, `DEFAULT_TIMEOUT_MS` — this pattern recurred in nearly every
   batch and never once caught a real bug).
7. **Does the test file's name and location match what it actually exercises?**
   `favorites-fns.test.ts` tests `favorites-handlers.ts`, not `favorites-fns.ts`.
   Route-level test files `-cameras.test.ts` and `-settings.test.ts` are wholesale
   verbatim duplicates of `CamerasPage.test.tsx`/`SettingsPage.test.tsx` — same
   function, same import path, same branches — because nobody checked whether a
   colocated test already existed before adding a route-level one.
8. **For a hook/component with real state or async logic, did I actually exercise
   it, or reach for a type-shape placeholder because "renderHook has version
   conflicts"?** `usePullToRefresh.test.ts` and `useRefetchOnMount.test.ts` both
   punt on real behavior this way — but sibling hooks with comparable complexity
   (`usePalette`, `useTheme`, `useFavoriteToggle`) successfully use `renderHook()`
   in this exact repo, so the excuse doesn't hold. If a sibling file proves it's
   possible, don't accept the placeholder.

### Good examples (keep doing this)

- **Fail-closed negative tests**: assert _no side effect happened_, not just that
  an error was thrown — `clip-proxy.test.ts` (401/400 guards assert `fetch` was
  never called), `favorites-fns.test.ts` (`writes no DB row when unauthorized`).
- **Minimal-mock integration**: `mqtt-cache.integration.test.ts` mocks only
  `mqtt.connect`/`fetch`, exercises real cache + client + handler wiring — caught
  a real race (in-flight request surviving a concurrent cache invalidation).
- **Boundary pairs, not scattered points**: `useLiveViewRefreshInterval.test.ts`
  (below-min / at-min / above-max / at-max), `send-throttle.test.ts` (blocks at
  `interval - 1`, allows at `interval`).
- **One test per genuinely distinct enum value**: `ThemeToggle.test.tsx` — exactly
  3 modes, 1 test each, plus 1 interaction test. Smallest file in the audit, zero
  padding, called out as the best-calibrated file found.
- **Isolation tests for shared state**: `favorites-store.test.ts` (cross-user),
  `sw-push-handlers.test.ts` (cross-camera notification merge) — the class of bug
  that silently corrupts one user/camera's data via another's action.

### Bad examples (the anti-pattern catalogue)

| Anti-pattern                                               | Example                                                                                                           | Why it's bad                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tests a hand-copied reimplementation, not the real code    | `useRefetchOnFocus.test.ts`, most of `usePushSubscription.test.ts`                                                | Stays green through a real regression — worse than no test                                      |
| Never imports the component/module under test              | `NotificationSettings.test.ts`                                                                                    | Same as above; 5 real conditional branches + optimistic-update logic have zero coverage         |
| Tautological constant check                                | `expect(SESSION_COOKIE_NAME).toBe('google-sso')`                                                                  | Can only fail on a deliberate edit; not a behavior test                                         |
| Type-shape placeholder for a hook with real logic          | `usePullToRefresh.test.ts`, `useRefetchOnMount.test.ts`                                                           | Builds an object literal, asserts a property of the literal it just wrote; never calls the hook |
| Cosmetic-input duplicate                                   | Same `typeof fps === 'number'` guard tested with `'n/a'`, `undefined`, `null` separately                          | Same branch, no new path; one boundary case would do                                            |
| CSS-class/DOM-structure as behavior proxy                  | `NavDrawer.test.tsx` `backdrop-blur` class match                                                                  | Breaks on harmless refactor, doesn't verify the actual visual requirement                       |
| Over-mocked wiring-only test                               | `EventCard.test.tsx` (every child mocked, only prop-forwarding asserted)                                          | Proves nothing about the component's actual conditional rendering                               |
| Log-string as the only assertion on a side effect          | `mqtt.test.ts` (`console.log` text match instead of `eventBatcher.add` call)                                      | A mutant that drops the real call but keeps the log line survives                               |
| Testing dead code                                          | `boundingBox.test.ts`, `mock-events.test.ts`                                                                      | Protects nothing reachable by the running app                                                   |
| Wholesale duplicate test file                              | `-cameras.test.ts` vs `CamerasPage.test.tsx`                                                                      | Same function/branches tested twice in two locations; delete the redundant one                  |
| "Contract" test that doesn't enforce the contract it names | `push-store.driver-contract.test.ts` (claims Node/Bun parity, no Bun-gated companion, never runs under Bun in CI) | Name promises more than the test infra actually delivers                                        |
| Misleading test name                                       | `"calls getEvent for all IDs in parallel"` (would pass for a sequential loop too)                                 | Gives false confidence about a property nothing checks                                          |

### The inverse failure mode: gaps hiding under a false sense of coverage

The audit also surfaced real coverage **holes** in exactly the places CLAUDE.md
calls non-negotiable — worth checking for whenever "we already have tests for
that" is used to wave off writing one:

- `isValidEventId` (SSRF/path-traversal guard, same tier as `isValidCameraName`)
  has zero dedicated tests anywhere.
- `requireSession()` is untested for 3 of 4 authenticated page-route loaders
  (`load-events.ts`, `load-event.ts`, `load-cameras.ts`) — only `favorites-fns.ts`'s
  guard is actually verified.
- `useCameraOrder.ts`'s real behavior (load/save/error-surfacing) and the
  quota-exceeded UI path are untested — `CamerasPage.test.tsx` mocks the hook out
  entirely, and the hook's own test file's docstring incorrectly claims that page
  test covers it.

## Why it matters

Test count is not a proxy for test value, and this codebase's ~958 tests are the
proof: some of the thinnest files (`ThemeToggle.test.tsx`, `test-auth-guard.test.ts`)
have zero padding, while some of the largest (`push-store.test.ts`,
`usePushSubscription.test.ts`) are majority duplicate or hollow. A test suite that
inflates its count with tautologies and reimplementation-echoes is worse than a
smaller one, because it costs real maintenance time (every refactor now has to
appease padding) while quietly leaving the actually-risky surfaces — security
validators, optimistic-update rollback, SSR/hydration hazards — uncovered. Applying
this checklist before adding a test (or when reviewing one written by a delegated
subagent) is cheaper than the alternative: discovering the gap in production.

## Related

- [[Home]]
- [[decisions/2026-04-14-server-function-authentication]] — the `requireSession()`
  policy behind the loader-coverage gap above
- [[gotchas/ssr-hydration-browser-globals]] — the bug class the SSR-safety tests
  in `usePalette`/`useTheme`/`useLiveViewRefreshInterval` correctly guard against
