# Plan: GitHub Pull Request Workflow

**Created**: 2026-04-16
**Branch**: main
**Status**: implemented

## Goal

Add a GitHub Actions workflow that runs type checking, linting, and tests on every pull request targeting `main`. Formatting is enforced at commit time via a Husky pre-commit hook running lint-staged with Prettier.

## Acceptance Criteria

- [x] AC-1: `.github/workflows/pr.yml` is a valid GitHub Actions workflow
- [x] AC-2: Triggers on `pull_request` with `branches: [main]`
- [x] AC-3: Type check step runs `tsc --noEmit` and fails on type errors
- [x] AC-4: Lint step runs `pnpm lint` and fails on violations
- [x] AC-5: Test step runs `pnpm test` and fails on test failures
- [x] AC-6: pnpm store cached via `actions/setup-node`
- [x] AC-7: Node version 22 matches Dockerfile
- [x] AC-8: `pnpm install --frozen-lockfile` prevents lockfile drift
- [x] AC-9: Husky pre-commit hook runs lint-staged
- [x] AC-10: lint-staged runs `prettier --write` on staged files

## Steps

### Step 1: Create the workflow file

**Complexity**: trivial
**Task**: Create `.github/workflows/pr.yml` with a single `quality` job triggered on `pull_request` to `main`. The job runs on `ubuntu-latest` with Node 22 and pnpm, and executes type checking, linting, and tests in sequence.
**Files**: `.github/workflows/pr.yml`

### Step 2: Set up Husky + lint-staged for pre-commit formatting

**Complexity**: trivial
**Task**: Install `husky` and `lint-staged`. Initialize Husky, configure pre-commit hook to run `npx lint-staged`. Add `lint-staged` config in `package.json` to run `prettier --write` on staged files.
**Files**: `package.json`, `.husky/pre-commit`

## Files Created / Modified

| File                       | Action                                                        | Step |
| -------------------------- | ------------------------------------------------------------- | ---- |
| `.github/workflows/pr.yml` | **New** — PR quality checks workflow                          | 1    |
| `.husky/pre-commit`        | **New** — runs lint-staged                                    | 2    |
| `package.json`             | Modified — added husky, lint-staged deps + lint-staged config | 2    |

## Pre-PR Quality Gate

- [ ] Workflow YAML is valid (passes `actionlint` or GitHub syntax check)
- [ ] Type check, lint, and tests pass locally
- [ ] Pre-commit hook triggers lint-staged on commit
- [ ] No secrets or environment variables required
