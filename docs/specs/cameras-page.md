# Spec: Cameras Page

## Intent Description

Add a new authenticated page at `/cameras` that displays all cameras connected to the Frigate NVR instance. The page calls the existing `getCameras()` client function to retrieve camera names, then renders each camera as a card with its name and latest snapshot image.

Since the Frigate server is on the internal network (not directly reachable by the browser), a server-side proxy API route is needed to serve camera snapshots to `<img>` tags. The Frigate API exposes `GET /api/<camera_name>/latest.jpg` for the most recent frame from each camera.

This also requires adding "Cameras" to the authenticated navigation links in the Header and adding a `getLatestSnapshot` function to the existing Frigate client module.

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

  # --- Navigation ---

  Scenario: Cameras link appears in header when authenticated
    Given the user is authenticated
    Then the header nav includes a "Cameras" link pointing to /cameras

  Scenario: Cameras link is not visible when unauthenticated
    Given the user is not authenticated
    Then the header nav does not include a "Cameras" link
```

## Architecture Specification

**Modified files**:

| File | Change |
|------|--------|
| `src/routes/_authenticated/cameras.tsx` | New route — page component with `createServerFn` loader |
| `src/routes/api/cameras/$name/latest.jpg.ts` | New API route — proxies snapshot from Frigate |
| `src/server/frigate/client.ts` | Add `getLatestSnapshot(cameraName)` function |
| `src/components/Header.tsx` | Add "Cameras" to `navLinks` array |

**Data flow**:

1. Route loader calls `createServerFn` which invokes `getCameras()` server-side
2. Page receives camera name list, renders a card per camera
3. Each card has `<img src="/api/cameras/{name}/latest.jpg">` — browser fetches the image
4. The API route proxies to `FRIGATE_URL/api/{name}/latest.jpg` and pipes the response back

**Why a proxy route**: The Frigate server is on the user's local network. The browser cannot reach it directly. The proxy route runs server-side where `FRIGATE_URL` is reachable.

**New Frigate client function**: `getLatestSnapshot(cameraName: string)` → `FrigateResult<ArrayBuffer>`. Calls `GET /api/<camera_name>/latest.jpg` via the existing `frigateBinary` helper.

**Constraints**:

- The proxy route must validate the camera name parameter (no path traversal)
- Snapshot images may be large — no base64 encoding, stream the binary response directly
- The page follows existing layout patterns (island-shell, page-wrap, rise-in)
- Auth is handled by session check in the proxy route handler (it's under `/api/`, not `/_authenticated/`)

## Acceptance Criteria

- [ ] `/cameras` route exists under `_authenticated` layout — renders for authenticated users, redirects for unauthenticated
- [ ] Page loads camera names from `getCameras()` via server function
- [ ] Each camera card displays an `<img>` with `src="/api/cameras/{name}/latest.jpg"`
- [ ] Empty state shows "No cameras found" when `getCameras` returns empty array
- [ ] Error state shows message when Frigate is unreachable
- [ ] Proxy route at `/api/cameras/$name/latest.jpg` serves JPEG from Frigate
- [ ] Proxy route returns 502 when Frigate is unreachable
- [ ] Proxy route validates camera name (rejects path traversal like `../`)
- [ ] Header nav includes "Cameras" link for authenticated users
- [ ] `getLatestSnapshot` function added to Frigate client with tests
- [ ] Page uses existing CSS patterns (island-shell, page-wrap, rise-in)
- [ ] Camera cards have 44px minimum touch targets

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
