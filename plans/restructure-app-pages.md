# Plan: Restructure App Pages

**Created**: 2026-04-14
**Branch**: main
**Status**: approved

## Goal

Replace the placeholder pages (About, Dashboard, Home) with three purpose-built pages: a public front page with Google login, an auth-protected Camera Events page with a `/$id` detail sub-page, and an auth-protected Settings placeholder. Uses a TanStack Router pathless layout route (`_authenticated`) to centralize auth guards across all protected routes.

## Acceptance Criteria

- [ ] All auth-protected routes (`/camera-events`, `/camera-events/$id`, `/settings`) share a single `_authenticated` layout route as their auth guard — no per-route auth checks
- [ ] `/` is a public page that shows a login CTA when unauthenticated and a welcome state when authenticated
- [ ] `/` displays the `AlertBanner` for `error` and `status` query params (existing behavior preserved)
- [ ] Auth error redirects from the OAuth callback (e.g., `/?error=login_failed`) continue to work — this is existing behavior in `callback.ts`, not new work
- [ ] `/camera-events` requires authentication; unauthenticated users are redirected to Google login with `returnTo=/camera-events`
- [ ] `/camera-events` displays a list of placeholder events, each linking to `/camera-events/$id`
- [ ] `/camera-events/$id` requires authentication and displays detail for the given event ID
- [ ] `/camera-events/$id` renders a "not found" UI with a back link when the ID does not match any event
- [ ] `/settings` requires authentication; unauthenticated users are redirected to Google login with `returnTo=/settings`
- [ ] `/settings` renders a placeholder settings page
- [ ] Header nav shows "Camera Events" and "Settings" links only when authenticated
- [ ] Header nav shows "Home" link always; external "Docs" link is removed
- [ ] `/about` route is removed — requests to `/about` fall through to the existing root `notFoundComponent` (404 page)
- [ ] `/dashboard` route is removed — requests to `/dashboard` fall through to the existing root `notFoundComponent` (404 page)
- [ ] All existing tests are updated or removed to reflect the new structure
- [ ] All new pure functions have unit tests
- [ ] The app builds without TypeScript errors and all tests pass after all steps are complete

## Steps

### Step 1: Create shared event data module and `_authenticated` layout route

**Complexity**: standard
**RED**: Write tests for:

- `getAuthRedirect(user, currentPath)` — returns `/api/auth/google?returnTo=<currentPath>` when user is null, returns null when user is present. Include a case with a dynamic path like `/camera-events/abc-123`.
- `PLACEHOLDER_EVENTS` — is a non-empty array where each entry has `id` (string), `title` (string), `timestamp` (string), and `camera` (string).
- `findEventById(id)` — returns the event for a known ID, returns `undefined` for an unknown ID.
  **GREEN**: Create `src/data/camera-events.ts` with the `CameraEvent` type, `PLACEHOLDER_EVENTS` array, and `findEventById` function. Create `src/routes/_authenticated.tsx` with `beforeLoad` auth guard using `getAuthRedirect`. Component renders `<Outlet />`.
  **REFACTOR**: None needed
  **Files**: `src/data/camera-events.ts`, `src/data/-camera-events.test.ts`, `src/routes/_authenticated.tsx`, `src/routes/-authenticated.test.ts`
  **Commit**: `add shared event data and _authenticated layout route`

### Step 2: Create camera events list page

**Complexity**: standard
**RED**: Write test for a pure `formatEventSummary(event)` function that returns a formatted string from event fields.
**GREEN**: Create `src/routes/_authenticated/camera-events.index.tsx` that imports `PLACEHOLDER_EVENTS` from `src/data/camera-events.ts` and renders a list. Each event links to `/camera-events/$id`.
**REFACTOR**: None needed
**Files**: `src/routes/_authenticated/camera-events.index.tsx`, `src/routes/_authenticated/-camera-events.test.ts`
**Commit**: `add camera events list page`

### Step 3: Create camera event detail page

**Complexity**: standard
**RED**: Write tests for a pure `getEventDetailContent(event)` function that formats event fields for display, AND a test that verifies the function returns a not-found content object (with heading "Event not found" and a back-link path) when event is undefined.
**GREEN**: Create `src/routes/_authenticated/camera-events.$id.tsx` that calls `findEventById` from the shared module. Renders event detail for valid IDs. Renders a "not found" UI with a "Back to Camera Events" link for unknown IDs.
**REFACTOR**: None needed
**Files**: `src/routes/_authenticated/camera-events.$id.tsx`, `src/routes/_authenticated/-camera-events-detail.test.ts`
**Commit**: `add camera event detail page`

### Step 4: Create settings placeholder page

**Complexity**: trivial
**RED**: Write test for a pure `getSettingsContent()` function returning heading and description strings.
**GREEN**: Create `src/routes/_authenticated/settings.tsx` with a minimal placeholder settings page.
**REFACTOR**: None needed
**Files**: `src/routes/_authenticated/settings.tsx`, `src/routes/_authenticated/-settings.test.ts`
**Commit**: `add settings placeholder page`

### Step 5: Update Header navigation

**Complexity**: standard
**RED**: Update `src/components/Header.test.tsx`: when unauthenticated, `navLinks` should contain only `{ label: 'Home', to: '/' }`; when authenticated, `navLinks` should contain Home, Camera Events (`/camera-events`), and Settings (`/settings`). Remove assertions about `dashboardHref`. Assert no Docs external link.
**GREEN**: Update `src/components/Header.tsx` — replace static About/Dashboard/Docs links with a data-driven `navLinks` array from `getHeaderAuthState`. Show Camera Events and Settings only when `user` is present. Remove the external Docs link.
**REFACTOR**: None needed
**Files**: `src/components/Header.tsx`, `src/components/Header.test.tsx`
**Commit**: `update header navigation for new page structure`

### Step 6: Rework front page

**Complexity**: standard
**RED**: Write test for a pure `getFrontPageContent(user)` function: when user is null, returns login CTA text and href (`/api/auth/google`); when user is present, returns welcome text with `firstName` and CTA linking to `/camera-events`.
**GREEN**: Replace placeholder content in `src/routes/index.tsx` with an app-focused landing page. Show Google login CTA when unauthenticated, "Go to Camera Events" when authenticated. Keep `AlertBanner` and `validateSearch` as-is.
**REFACTOR**: Remove stale "TanStack Start Base Template" placeholder content and feature cards.
**Files**: `src/routes/index.tsx`, `src/routes/-index.test.ts`
**Commit**: `rework front page with auth-aware content`

### Step 7: Remove stale routes and tests

**Complexity**: trivial
**Note**: This is a cleanup step, not a behavior change. No TDD RED phase — validation is a grep confirming zero imports of the deleted files.
**Verify**: `grep -r 'about' src/routes/` and `grep -r 'dashboard' src/routes/` confirm no remaining references (excluding the files being deleted).
**Delete**: `src/routes/about.tsx`, `src/routes/dashboard.tsx`, `src/routes/-dashboard.test.ts`
**Post-check**: Run `npx tsc --noEmit` and `npx vitest run` to confirm the app builds and all tests pass.
**Commit**: `remove about and dashboard routes`

## Complexity Classification

| Rating     | Criteria                                                                         | Review depth                                        |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `trivial`  | Single-file rename, config change, typo fix, documentation-only                  | Skip inline review; covered by final `/code-review` |
| `standard` | New function, test, module, or behavioral change within existing patterns        | Spec-compliance + relevant quality agents           |
| `complex`  | Architectural change, security-sensitive, cross-cutting concern, new abstraction | Full agent suite including opus-tier agents         |

## Pre-PR Quality Gate

- [ ] All tests pass
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] Linter passes (`npx eslint src/`)
- [ ] `/code-review` passes

## Risks & Open Questions

- **Placeholder event data**: Camera events use hardcoded placeholder data. A future step will replace this with real data from an API or database. The placeholder structure (id, title, timestamp, camera) should match the likely real schema.
- **Route generation**: TanStack Router auto-generates `routeTree.gen.ts`. Adding/removing route files will trigger regeneration. Each step should run the dev server or codegen to update the generated file before committing.
- **`_authenticated` directory creation**: The `_authenticated/` directory is new. TanStack Router's file-based routing uses the underscore-prefix convention for pathless layout routes — this is well-documented and standard.
- **No shared layout for camera-events sub-pages**: The list and detail pages are flat siblings under `_authenticated`, not nested under a `camera-events.tsx` layout. If shared chrome (breadcrumbs, sidebar) is needed later, a layout route can be introduced then.

## Plan Review Summary

All four review personas approved (Acceptance Test Critic approved after one revision round).

**Key warnings addressed in revision:**

- Added explicit acceptance criterion for `_authenticated` as the single centralized auth guard
- Added error-path criterion confirming existing OAuth callback error redirects are preserved (not new work)
- Step 3 RED now explicitly tests the "not found" UI content (heading + back link), not just the data lookup
- Step 7 re-labeled as a cleanup step (no TDD RED phase) with grep verification + tsc/vitest post-checks
- Added 404 fallthrough criteria for removed routes (`/about`, `/dashboard` → existing `notFoundComponent`)
- Shared event data extracted into `src/data/camera-events.ts` from the start (Step 1), not deferred

**Remaining warnings (non-blocking):**

- Ensure `_authenticated.tsx` `beforeLoad` delegates to the pure `getAuthRedirect` function so tests cover the actual guard logic
- `getHeaderAuthState` return shape change in Step 5 is a non-trivial refactor of the existing pure function contract
- Existing `/about` link in `index.tsx` ("About This Starter") must be removed during Step 6 front page rework
- Consider adding `pendingComponent` to `_authenticated` layout for slow-connection loading state (deferred — not in scope)
- If shared layout chrome (breadcrumbs) is needed for camera-events pages, a layout route can be added later
- The `CameraEvent` type in `src/data/camera-events.ts` should be designed to match the likely real API schema
