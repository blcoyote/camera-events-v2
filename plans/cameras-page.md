# Plan: Cameras Page

**Created**: 2026-04-14
**Branch**: main
**Status**: implemented

## Goal

Add a new authenticated `/cameras` page that displays all cameras connected to the Frigate NVR instance. Each camera is rendered as a card showing its name and latest snapshot image, fetched via a server-side proxy route. This also adds `getLatestSnapshot` to the Frigate client and a "Cameras" nav link in the Header.

## Acceptance Criteria

- [ ] `/cameras` route exists under `_authenticated` layout — renders for authenticated users, redirects for unauthenticated
- [ ] Page loads camera names from `getCameras()` via server function
- [ ] Each camera card displays an `<img>` with `src="/api/cameras/{name}/latest.jpg"` and descriptive `alt` text
- [ ] Empty state shows "No cameras found" when `getCameras` returns empty array
- [ ] Error state shows message when Frigate is unreachable
- [ ] Broken-image fallback: if a snapshot fails to load, the card shows a "Snapshot unavailable" placeholder
- [ ] Loading state: route defines a `pendingComponent` shown while camera data loads
- [ ] Proxy route at `/api/cameras/$name/latest.jpg` serves JPEG from Frigate with `Cache-Control: no-store`
- [ ] Proxy route returns 502 when Frigate is unreachable
- [ ] Proxy route returns 401 when user is not authenticated
- [ ] Proxy route validates camera name (rejects path traversal like `../`)
- [ ] Header nav includes "Cameras" link for authenticated users
- [ ] `getLatestSnapshot` function added to Frigate client with tests
- [ ] Page uses existing CSS patterns (island-shell, page-wrap, rise-in)
- [ ] Camera cards have 44px minimum touch targets
- [ ] Camera grid section has `aria-label` for screen reader landmark navigation

## User-Facing Behavior

```gherkin
Feature: Cameras page

  Background:
    Given the user is authenticated
    And the environment variable FRIGATE_URL is set

  # --- Page access ---

  Scenario: Authenticated user navigates to /cameras
    When the user visits /cameras
    Then they see a page with heading "Cameras"
    And a list of camera cards is displayed

  Scenario: Unauthenticated user is redirected
    Given the user is not authenticated
    When the user visits /cameras
    Then they are redirected to the Google sign-in flow

  # --- Camera list ---

  Scenario: Cameras are loaded from Frigate
    Given Frigate reports cameras "backyard", "front_door", "garage"
    When the cameras page loads
    Then three camera cards are displayed
    And each card shows the camera name

  Scenario: Each camera card shows its latest snapshot
    Given Frigate reports camera "front_door"
    When the cameras page loads
    Then the "front_door" card contains an image element
    And the image src points to the snapshot proxy "/api/cameras/front_door/latest.jpg"

  Scenario: No cameras configured in Frigate
    Given Frigate reports zero cameras
    When the cameras page loads
    Then an empty state message is displayed: "No cameras found"

  Scenario: Frigate is unreachable
    Given the Frigate server is not reachable
    When the cameras page loads
    Then an error message is displayed indicating cameras could not be loaded

  # --- Snapshot proxy ---

  Scenario: Snapshot proxy serves camera image
    When a GET request is made to /api/cameras/front_door/latest.jpg
    Then the server proxies the request to FRIGATE_URL/api/front_door/latest.jpg
    And returns the JPEG response to the client

  Scenario: Snapshot proxy returns 502 when Frigate is unreachable
    Given the Frigate server is not reachable
    When a GET request is made to /api/cameras/front_door/latest.jpg
    Then the server returns HTTP 502

  Scenario: Snapshot proxy rejects path traversal
    When a GET request is made to /api/cameras/../etc/passwd/latest.jpg
    Then the server returns HTTP 400

  Scenario: Snapshot proxy requires authentication
    Given the user is not authenticated
    When a GET request is made to /api/cameras/front_door/latest.jpg
    Then the server returns HTTP 401

  # --- Image loading ---

  Scenario: Snapshot image has descriptive alt text
    Given Frigate reports camera "front_door"
    When the cameras page loads
    Then the "front_door" card image has alt text "Latest snapshot from front_door"

  Scenario: Snapshot fails to load
    Given Frigate reports camera "front_door"
    And the snapshot proxy returns an error for "front_door"
    When the cameras page loads
    Then the "front_door" card shows a "Snapshot unavailable" placeholder

  # --- Navigation ---

  Scenario: Cameras link appears in header when authenticated
    Given the user is authenticated
    Then the header nav includes a "Cameras" link pointing to /cameras

  Scenario: Cameras link is not visible when unauthenticated
    Given the user is not authenticated
    Then the header nav does not include a "Cameras" link
```

## Steps

### Step 1: Add `getLatestSnapshot` to Frigate client

**Complexity**: standard
**RED**: Write tests in `src/server/frigate/client.test.ts` for `getLatestSnapshot(cameraName)`:

- Returns `FrigateResult<ArrayBuffer>` on success, calling `GET /api/<camera_name>/latest.jpg`
- Returns `{ ok: false }` on HTTP error
- Returns `{ ok: false }` on network failure
  **GREEN**: Add `getLatestSnapshot` to `src/server/frigate/client.ts` using the existing `frigateBinary` helper
  **REFACTOR**: None needed — follows established pattern
  **Files**: `src/server/frigate/client.ts`, `src/server/frigate/client.test.ts`
  **Commit**: `feat(frigate): add getLatestSnapshot client function`

### Step 2: Add camera name validation utility

**Complexity**: standard
**RED**: Write tests in `src/server/frigate/validation.test.ts` for `isValidCameraName(name)`:

- Returns `true` for valid names like `front_door`, `backyard`, `garage-cam`
- Returns `false` for path traversal attempts: `../etc/passwd`, `foo/../bar`, `..`
- Returns `false` for empty string
- Returns `false` for names containing slashes: `foo/bar`
- Returns `false` for names with null bytes or control characters
  **GREEN**: Create `src/server/frigate/validation.ts` with `isValidCameraName` — allows only `[a-zA-Z0-9_-]` characters
  **REFACTOR**: None needed
  **Files**: `src/server/frigate/validation.ts`, `src/server/frigate/validation.test.ts`
  **Commit**: `feat(frigate): add camera name validation`

### Step 3: Create snapshot proxy API route

**Complexity**: complex
**RED**: Write tests in `src/routes/api/cameras/-snapshot-proxy.test.ts` for pure handler logic extracted as `handleSnapshotRequest(cameraName, isAuthenticated)`:

- Returns binary response with `Content-Type: image/jpeg` and `Cache-Control: no-store` on success
- Returns 502 when Frigate is unreachable
- Returns 400 when camera name fails validation
- Returns 401 when user is not authenticated
  **GREEN**: Create `src/routes/api/cameras/$name/latest.jpg.ts` with a GET handler that:

1. Checks session authentication via `useSession`
2. Validates camera name via `isValidCameraName`
3. Calls `getLatestSnapshot(name)`
4. Returns the binary response with `Content-Type: image/jpeg` and `Cache-Control: no-store`, or appropriate error status
   **REFACTOR**: None needed
   **Files**: `src/routes/api/cameras/$name/latest.jpg.ts`, `src/routes/api/cameras/-snapshot-proxy.test.ts`
   **Commit**: `feat(cameras): add snapshot proxy API route`

### Step 4: Create cameras page route

**Complexity**: standard
**RED**: Write tests in `src/routes/_authenticated/-cameras.test.ts` for:

- Pure function that categorizes loader result into `cameras | empty | error` state
- Camera card data: name → `{ name, imgSrc, altText }` mapping
- Alt text format: `"Latest snapshot from {camera_name}"`
  **GREEN**: Create `src/routes/_authenticated/cameras.tsx` with:

1. `createServerFn` loader that calls `getCameras()`
2. `pendingComponent` showing a loading indicator while data loads
3. Page component with island-shell/page-wrap/rise-in layout
4. Camera grid section with `aria-label="Camera list"`
5. Camera cards, each with name and `<img src="/api/cameras/{name}/latest.jpg" alt="Latest snapshot from {name}">`
6. `onError` handler on `<img>` that swaps in a "Snapshot unavailable" placeholder
7. Empty state: "No cameras found" message
8. Error state: message when Frigate is unreachable
9. 44px minimum touch targets on camera cards
   **REFACTOR**: None needed
   **Files**: `src/routes/_authenticated/cameras.tsx`, `src/routes/_authenticated/-cameras.test.ts`
   **Commit**: `feat(cameras): add cameras page with card grid`

### Step 5: Add "Cameras" to Header navigation

**Complexity**: trivial
**RED**: Existing `getHeaderAuthState` tests in `src/components/Header.test.ts` — update to assert "Cameras" link present for authenticated users
**GREEN**: Add `{ label: 'Cameras', to: '/cameras' }` to `navLinks` array in `getHeaderAuthState`
**REFACTOR**: None needed
**Files**: `src/components/Header.tsx`, `src/components/Header.test.ts`
**Commit**: `feat(cameras): add Cameras link to header nav`

## Complexity Classification

| Rating     | Criteria                                                                         | Review depth                                        |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `trivial`  | Single-file rename, config change, typo fix, documentation-only                  | Skip inline review; covered by final `/code-review` |
| `standard` | New function, test, module, or behavioral change within existing patterns        | Spec-compliance + relevant quality agents           |
| `complex`  | Architectural change, security-sensitive, cross-cutting concern, new abstraction | Full agent suite including opus-tier agents         |

## Pre-PR Quality Gate

- [ ] All tests pass
- [ ] Type check passes
- [ ] Linter passes
- [ ] `/code-review` passes
- [ ] Documentation updated (if applicable)

## Risks & Open Questions

- **Proxy route auth**: The snapshot proxy is under `/api/`, not `/_authenticated/`, so it must check the session manually. This follows the same pattern as the existing auth routes.
- **Large images**: Snapshots should be streamed as binary, not base64-encoded. The `ArrayBuffer` approach from `frigateBinary` handles this.
- **File routing for `.jpg.ts`**: TanStack Start's file-based routing should handle `latest.jpg.ts` as a route serving `/api/cameras/$name/latest.jpg`. If TanStack Start does not support the double-extension pattern, fallback to `latest.ts` returning JPEG with explicit `Content-Type`. Validate early in Step 3.
- **Proxy caching**: Snapshots are live images; `Cache-Control: no-store` ensures freshness. If performance becomes an issue, a short `max-age` can be added as a fast-follow.

## Plan Review Summary

Four review perspectives were consulted. Three approved; the UX critic required revisions.

**Addressed blockers (UX)**:

- Added `alt` text requirement for snapshot images (`"Latest snapshot from {name}"`)
- Added broken-image fallback (`onError` → "Snapshot unavailable" placeholder)
- Added `pendingComponent` for loading state while camera data fetches

**Incorporated warnings**:

- Added proxy auth (401) and path-traversal (400) scenarios to Gherkin (Acceptance Critic)
- Updated test file names to dash-prefix convention (`-snapshot-proxy.test.ts`, `-cameras.test.ts`) (Architecture Critic)
- Added `Cache-Control: no-store` on proxy responses (Strategic Critic, UX Critic)
- Added `aria-label="Camera list"` on camera grid section (UX Critic)
- Noted `.jpg.ts` routing risk with fallback strategy (Architecture Critic, Strategic Critic)

**Noted for future consideration**:

- Camera cards are display-only for now (no click destination); touch target criterion applies to the card container for potential future interactivity
- Retry mechanism on error state deferred — initial implementation shows static error message
