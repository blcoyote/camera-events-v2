# Spec: GitHub Pull Request Workflow

## Intent Description

Add a GitHub Actions workflow that runs on every pull request targeting `main`. The workflow validates code quality and correctness by running type checking, linting, and the full test suite. This provides an automated quality gate so that broken code, style violations, and test failures are caught before merge. The workflow uses the same Bun setup that the project already uses for local development and the Dockerfile. Formatting is enforced at commit time via a Husky pre-commit hook running lint-staged with Prettier, rather than in CI.

## User-Facing Behavior

```gherkin
Feature: GitHub pull request checks

  Background:
    Given a GitHub Actions workflow file exists at .github/workflows/pr.yml
    And the workflow triggers on pull requests targeting main

  # --- Quality checks ---

  Scenario: PR with clean code passes all checks
    Given a pull request with code that passes type checking, linting, and tests
    When the workflow runs
    Then the "Type Check" step passes
    And the "Lint" step passes
    And the "Test" step passes
    And the overall workflow status is "success"

  Scenario: PR with type errors fails type check
    Given a pull request that introduces a TypeScript type error
    When the workflow runs
    Then the "Type Check" step fails
    And the overall workflow status is "failure"

  Scenario: PR with lint violations fails lint
    Given a pull request that introduces an ESLint violation
    When the workflow runs
    Then the "Lint" step fails
    And the overall workflow status is "failure"

  Scenario: PR with failing tests fails test step
    Given a pull request that introduces a test failure
    When the workflow runs
    Then the "Test" step fails
    And the overall workflow status is "failure"

  # --- Pre-commit formatting ---

  Scenario: Staged files are formatted on commit
    Given Husky and lint-staged are installed
    When a developer commits files with formatting issues
    Then lint-staged runs Prettier --write on staged files
    And the commit includes the formatted versions

  # --- Dependency caching ---

  Scenario: Dependencies install quickly on each run
    Given the workflow uses `oven-sh/setup-bun` to install Bun
    When a new PR triggers the workflow
    Then `bun install --frozen-lockfile` completes without modifying `bun.lock`
    And no separate dependency cache step is needed

  # --- Trigger scope ---

  Scenario: Workflow runs on PR open and push
    When a pull request is opened against main
    Then the workflow triggers
    When a new commit is pushed to an open PR targeting main
    Then the workflow triggers again

  Scenario: Workflow does not run on pushes to main
    When a commit is pushed directly to main (not via PR)
    Then the workflow does not trigger
```

## Architecture Specification

### Workflow Structure

```
.github/workflows/pr.yml
    │
    ├── trigger: pull_request → main
    │
    └── job: quality
        ├── runs-on: ubuntu-latest
        ├── steps:
        │   ├── Checkout code
        │   ├── Setup Bun (via oven-sh/setup-bun)
        │   ├── Install dependencies (bun install --frozen-lockfile)
        │   ├── Type Check (bun x tsc --noEmit)
        │   ├── Lint (bun run lint)
        │   └── Test (bun run test)
```

### Components

| Component          | Location                           | Responsibility                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| PR workflow        | `.github/workflows/pr.yml`         | Orchestrates type check, lint, and test on pull requests           |
| Pre-commit hook    | `.husky/pre-commit`                | Runs lint-staged before each commit                                |
| lint-staged config | `package.json` (`lint-staged` key) | Runs `prettier --write` on staged files matching common extensions |

### Design Decisions

| Decision               | Resolution                                               | Rationale                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting enforcement | Pre-commit hook (Husky + lint-staged) instead of CI step | Formatting is a local concern — fix it before it reaches the remote. Avoids CI failures for cosmetic issues and auto-formats on commit so developers don't need to remember. |
| Single job vs. matrix  | Single job with sequential steps                         | Project is small; parallelizing 4 fast checks across jobs adds overhead without meaningful time savings. A single job avoids redundant checkout/install steps.               |
| Runtime                | Bun (matches Dockerfile `oven/bun` image)                | Consistency between CI and production runtime                                                                                                                                |
| Bun install flag       | `--frozen-lockfile`                                      | Prevents accidental lockfile changes in CI; matches Dockerfile behavior                                                                                                      |
| Bun setup              | `oven-sh/setup-bun`                                      | Official action; installs the Bun runtime directly, no separate Node.js setup needed                                                                                         |
| Cache strategy         | None — relies on `bun install`'s speed                   | Bun installs are fast enough that an explicit CI dependency cache step isn't worth the added complexity                                                                      |
| Type check command     | `bun x tsc --noEmit`                                     | Runs TypeScript compiler without emitting files; catches type errors                                                                                                         |
| Test command           | `bun run test` (runs `vitest run`)                       | Uses existing package.json script; `run` flag ensures non-interactive single pass                                                                                            |
| Trigger events         | `pull_request` only (not `push`)                         | PRs are the merge gate; push-to-main checks can be added later if needed                                                                                                     |

### Constraints

- No secrets are required for the quality checks (no Frigate URL, MQTT, VAPID keys, etc.)
- The workflow must not run `npx tsr generate` (per CLAUDE.md — destructive unrelated tool)
- `better-sqlite3` requires native compilation; `ubuntu-latest` provides the necessary build tools
- The workflow should not deploy anything or push any artifacts

## Acceptance Criteria

| #     | Criterion                 | Pass condition                                                          |
| ----- | ------------------------- | ----------------------------------------------------------------------- |
| AC-1  | Workflow file exists      | `.github/workflows/pr.yml` is a valid GitHub Actions workflow           |
| AC-2  | Triggers on PRs to main   | `on: pull_request` with `branches: [main]`                              |
| AC-3  | Type check runs           | Step executes `tsc --noEmit` and fails the job on type errors           |
| AC-4  | Lint runs                 | Step executes `bun run lint` and fails the job on lint violations       |
| AC-5  | Tests run                 | Step executes `bun run test` and fails the job on test failures         |
| AC-6  | Dependencies install fast | `bun install --frozen-lockfile` completes without a separate cache step |
| AC-7  | Bun runtime used          | `oven-sh/setup-bun` matches the Dockerfile's `oven/bun` base image      |
| AC-8  | Frozen lockfile           | `bun install --frozen-lockfile` prevents lockfile drift                 |
| AC-9  | Pre-commit hook           | Husky pre-commit hook runs lint-staged                                  |
| AC-10 | Staged files formatted    | lint-staged runs `prettier --write` on staged files                     |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
