---
name: test-driven-development
description: Enforce RED-GREEN-REFACTOR with evidence gates. Use when implementing a feature, fixing a bug, adding or changing behaviour, writing a test, or reviewing whether TDD discipline was followed — any time implementation code will be written or modified.
---

# Test-Driven Development

The project's test conventions (placement, mocking patterns, commands) live in `.claude/rules/testing.md`. That file is path-scoped and only loads once a test file is open, so **read it before writing the first test**. This skill adds the discipline and evidence gates on top.

## Iron Law

No production code without a failing test first. Code written before its test is set aside (stash it or move it out of the way, never delete uncommitted work) and re-derived from the test.

## The Cycle

1. **RED** — write the smallest test for the next behavior. Run `bun run test -- <filter>`. It must fail for the expected reason (assertion failure, not a typo or import crash). Show the failing output before continuing.
2. **GREEN** — write the minimum code to pass. Run the tests; all must pass. Show the passing output. Add nothing the test doesn't require.
3. **REFACTOR** — improve names and structure with tests green. Re-run after every change; if anything breaks, undo and take a smaller step.

## Vertical slices only

One test → one implementation → repeat. Never write all tests first and all code after: bulk tests describe imagined behavior and go blind to real changes. The first slice is a tracer bullet that proves the path end to end.

## Rationalizations that mean "stop, write the test"

"Too simple to test", "I'll add tests after", "I need to see the shape first" (spike, throw it away, then TDD), "I tested it manually", "keep it as reference", "just this once". Code written without a test is set aside, not adapted.

## Exceptions

Ask the user before skipping TDD for throwaway spikes, generated code, or pure config. Record the exception.

## Done when

- [ ] Every new function has a test that was seen failing for the right reason
- [ ] Minimal code written per test; all tests pass with clean output
- [ ] Edge cases and error paths covered
