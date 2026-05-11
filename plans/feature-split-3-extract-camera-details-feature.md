# Plan: Feature Split 3 — Extract `camera-details` Feature + Clean Up `camera-events`

**Created**: 2026-05-11
**Branch**: main
**Spec**: docs/specs/feature-split-3-extract-camera-details-feature.md
**Depends on**: plans/feature-split-2-extract-favorites-feature.md
**Status**: implemented

## Goal

Move the event detail page and all of its exclusive dependencies out of
`src/features/camera-events/` and into a new `src/features/camera-details/`
feature. After this plan lands, `camera-events/` contains only the list page
and its direct dependencies (list page component, loading skeleton, filter
pill, mock data), and `camera-details/` contains the detail page, snapshot
lightbox, event snapshot, info card, blob download hook, and the three
Frigate proxy handlers (clip, snapshot, thumbnail).

This is a pure structural relocation: every file moved keeps the same
contents (modulo updated relative import paths). The three `/api/events/:id/*`
endpoints retain their URLs; only the import paths inside the route handler
files change. Test files move with the source files they cover.

This is the third and final plan in the feature-split refactor. Plans 1 and 2
must have landed first:

- Plan 1 moved shared event utilities (formatRelativeTime, formatLabelName,
  getLabelDotColor, formatCameraName, EventCard/EventThumbnail/SkeletonCard,
  the Frigate config/types/client/validation/session helpers) into
  `src/features/shared/`. After Plan 1, `EventSnapshot.tsx` and
  `CameraEventDetailPage.tsx` import format utilities from
  `#/features/shared/utils/eventFormatting` (no longer from `../utils`).
- Plan 2 extracted the favorites feature. After Plan 2,
  `FavoriteButton` and `useFavoriteToggle` live in shared (re-exported by the
  favorites feature), so `CameraEventDetailPage.tsx` imports them from
  `#/features/shared/...` and the test file's `vi.mock(...)` paths point at
  the shared module paths.

Effectively, by the time this plan runs, `CameraEventDetailPage.tsx` and the
other files in this plan no longer reference `../utils`, `../hooks/`, or
`./FavoriteButton` from within `camera-events/`. The only imports left are
to `#/features/shared/...` plus relative siblings inside the move set
(`./SnapshotLightbox`, `./EventSnapshot`, `./InfoCard`, `./useBlobDownload`).
This makes the actual moves mechanical.

## Acceptance Criteria

1. `src/features/camera-details/` exists with the following file layout:
   - `components/CameraEventDetailPage.tsx`
   - `components/CameraEventDetailPage.test.tsx`
   - `components/SnapshotLightbox.tsx`
   - `components/SnapshotLightbox.test.tsx`
   - `components/EventSnapshot.tsx`
   - `components/InfoCard.tsx`
   - `hooks/useBlobDownload.ts`
   - `server/clip-proxy.ts`
   - `server/clip-proxy.test.ts`
   - `server/snapshot-proxy.ts`
   - `server/snapshot-proxy.test.ts`
   - `server/thumbnail-proxy.ts`
2. `src/features/camera-events/` contains none of:
   `CameraEventDetailPage.*`, `SnapshotLightbox.*`, `EventSnapshot.*`,
   `InfoCard.*`, `useBlobDownload.*`, `clip-proxy.*`, `snapshot-proxy.*`,
   `thumbnail-proxy.*`. Its final contents are:
   - `components/CameraEventsListPage.tsx`
   - `components/CameraEventsListPage.test.tsx`
   - `components/CameraEventsLoading.tsx`
   - `components/FilterPill.tsx`
   - `data/mock-events.ts`
   - `data/mock-events.test.ts`
     (Exact file set after Plan 1+2 is whatever those plans left behind — the
     point is that detail-only files are gone.)
3. `src/routes/_authenticated/camera-events.$id.tsx` imports
   `CameraEventDetailPage` from `#/features/camera-details/components/CameraEventDetailPage`.
4. `src/routes/api/events/$id/clip.ts` imports `handleClipRequest` from
   `#/features/camera-details/server/clip-proxy`.
5. `src/routes/api/events/$id/snapshot.ts` imports `handleSnapshotRequest`
   from `#/features/camera-details/server/snapshot-proxy`.
6. `src/routes/api/events/$id/thumbnail.ts` imports `handleThumbnailRequest`
   from `#/features/camera-details/server/thumbnail-proxy`.
7. No file in `camera-details/` imports from `camera-events/` or
   `favorites/`. No file in `camera-events/` imports from `camera-details/`
   or `favorites/`.
8. `CLAUDE.md` Feature Map reflects the final four-row structure
   (`auth`, `camera-events` narrowed, `camera-details` new, `cameras`,
   `favorites`, `home`, `push-notifications`, `settings`, `shared`,
   `shell` — the diff is: narrow `camera-events`, add `camera-details`).
9. `bun run test` — all Vitest tests pass.
10. `bun run lint` — clean.
11. `bun run build` — clean (proves TypeScript compiles and the route tree
    regenerates without errors).
12. Manually verified: visiting `/camera-events/<id>` in a running dev
    server still renders the detail page; the snapshot lightbox still opens
    and closes; clip and snapshot download links still produce a download
    via the proxy URLs.

## User-Facing Behavior

Copied verbatim from the spec:

```gherkin
Feature: Extract camera-details feature and clean up camera-events (zero behavior change)

  Scenario: Event detail page loads after extraction
    Given the user is authenticated
    And event "abc123" exists in Frigate
    When the user navigates to /camera-events/abc123
    Then the event detail page renders with the event snapshot
    And the camera name, detection label, duration, and zones are displayed
    And the detection confidence bar is shown when score > 0
    And the favorite button reflects the current favorite state

  Scenario: Snapshot lightbox opens on the detail page
    Given the user is viewing an event detail with a snapshot
    When the user taps the snapshot image
    Then the full-screen lightbox opens
    And pressing Escape or clicking outside closes it

  Scenario: Clip download works from the detail page
    Given the user is viewing an event with a clip
    When the user activates the clip download link
    Then the browser downloads the clip via /api/events/:id/clip

  Scenario: Snapshot download works from the detail page
    Given the user is viewing an event with a snapshot
    When the user activates the snapshot download link
    Then the browser downloads the snapshot via /api/events/:id/snapshot?download=true

  Scenario: Events list is unaffected by the camera-details extraction
    Given the user is authenticated
    When the user navigates to /camera-events
    Then the events list renders identically to before the refactor
    And filter pills, event cards, and skeletons all function correctly

  Scenario: No detail-only files remain in camera-events after extraction
    Given the refactored codebase
    Then src/features/camera-events/ contains no file named
    CameraEventDetailPage, SnapshotLightbox, EventSnapshot, InfoCard,
    useBlobDownload, clip-proxy, snapshot-proxy, or thumbnail-proxy
```

## Strategy Notes

- This refactor changes file locations and import paths only. No production
  behavior changes, no test logic changes. Each step moves a small set of
  files together with the tests that cover them, then re-runs `bun run test`
  to prove the slice is green before the next step.
- For pure relocations the TDD framing is: **RED = test that currently
  passes from the old path must keep passing from the new path**. There is
  no failing test to write first — the existing tests serve as the
  regression net. The "RED" sub-step within each move is therefore: before
  the move, confirm the existing test passes (so we know the green state we
  need to preserve); after the move, run the tests and confirm they pass
  from the new location. If they don't, the relocation is wrong.
- For each component move, prefer `git mv` so renames are recorded as
  renames in the history (better blame, better PR review). Where the move
  also requires editing a relative import inside the moved file, the
  follow-up edit lives in the same commit.
- Detail-page-internal sibling imports (`./SnapshotLightbox`,
  `./EventSnapshot`, `./InfoCard`) keep their relative form — they all move
  together into `camera-details/components/`.
- The `useBlobDownload` hook is referenced by `InfoCard.tsx` via
  `../hooks/useBlobDownload`. After the move, that relative path still
  works because `InfoCard` lives at `camera-details/components/` and
  `useBlobDownload` at `camera-details/hooks/`.

## Steps

Each step is a discrete commit. Tests are run after every step. Order
matters only insofar as we want each commit to leave the repo green.

---

### Step 1 — Create `camera-details/` directory skeleton

**Complexity:** trivial

**Why first:** Establish the target directory so subsequent `git mv` calls
have somewhere to land. No files yet; just the folder structure.

**RED:** N/A — directory creation only.

**GREEN:**

- Create empty directories:
  - `src/features/camera-details/`
  - `src/features/camera-details/components/`
  - `src/features/camera-details/hooks/`
  - `src/features/camera-details/server/`
- Add a `.gitkeep` in each leaf folder if needed to make git track the empty
  dir. Remove the `.gitkeep` files in the same commits that fill the folder
  with real files (Steps 2–4).

**REFACTOR:** N/A.

**Files added:**

- `src/features/camera-details/components/.gitkeep`
- `src/features/camera-details/hooks/.gitkeep`
- `src/features/camera-details/server/.gitkeep`

**Verification:** `bun run test`, `bun run lint`.

**Commit message:**

```
chore(camera-details): scaffold empty feature directory

Establish src/features/camera-details/{components,hooks,server} so the
upcoming detail-page extraction has a target tree. No source files yet.
```

---

### Step 2 — Move detail-page presentation components

**Complexity:** trivial (each file is a straight relocation; the relative
imports between the four components remain valid because they all move
together)

**Why second:** The four detail-page components depend on each other but on
no other code outside of `#/features/shared/` (after Plans 1 and 2). Move
them as a group so no half-state exists where one component lives in a
different feature from its siblings.

**Pre-move sanity check (RED-equivalent):**

```bash
bun run test -- CameraEventDetailPage SnapshotLightbox
```

Confirm both test files pass from their current location in
`camera-events/components/`.

**GREEN:**

1. `git mv src/features/camera-events/components/CameraEventDetailPage.tsx \
src/features/camera-details/components/CameraEventDetailPage.tsx`
2. `git mv src/features/camera-events/components/CameraEventDetailPage.test.tsx \
src/features/camera-details/components/CameraEventDetailPage.test.tsx`
3. `git mv src/features/camera-events/components/SnapshotLightbox.tsx \
src/features/camera-details/components/SnapshotLightbox.tsx`
4. `git mv src/features/camera-events/components/SnapshotLightbox.test.tsx \
src/features/camera-details/components/SnapshotLightbox.test.tsx`
5. `git mv src/features/camera-events/components/EventSnapshot.tsx \
src/features/camera-details/components/EventSnapshot.tsx`
6. `git mv src/features/camera-events/components/InfoCard.tsx \
src/features/camera-details/components/InfoCard.tsx`
7. `git mv src/features/camera-events/hooks/useBlobDownload.ts \
src/features/camera-details/hooks/useBlobDownload.ts`
8. Delete `src/features/camera-details/components/.gitkeep` and
   `src/features/camera-details/hooks/.gitkeep`.
9. Update `src/routes/_authenticated/camera-events.$id.tsx` so the
   `CameraEventDetailPage` import points at the new location:
   - Replace
     `from '#/features/camera-events/components/CameraEventDetailPage'`
     with
     `from '#/features/camera-details/components/CameraEventDetailPage'`.
10. No edits to the moved component files themselves should be required:
    - `CameraEventDetailPage.tsx`'s relative imports
      (`./SnapshotLightbox`, `./EventSnapshot`, `./InfoCard`) still resolve
      because all three siblings moved with it.
    - After Plan 2, `useFavoriteToggle` and `FavoriteButton` are imported
      from `#/features/shared/...`, so those absolute imports already
      resolve correctly from the new location.
    - After Plan 1, `EventSnapshot.tsx`'s format-util import points at
      `#/features/shared/utils/eventFormatting` and not `../utils`, so it
      keeps resolving.
    - `InfoCard.tsx` imports `../hooks/useBlobDownload` — after the move
      both files live in `camera-details/`, so this path is still valid.
    - `SnapshotLightbox.tsx` and `useBlobDownload.ts` have no internal
      imports that cross feature boundaries.

**REFACTOR:** None this step. Verify the test file
`CameraEventDetailPage.test.tsx` is unchanged — its `vi.mock('../hooks/useFavoriteToggle', ...)`
and `vi.mock('./FavoriteButton', ...)` paths would have been rewritten by
Plan 2 to point at the shared module specifiers. If you discover those
mock paths still reference relative paths into `camera-events/`, stop and
escalate to the orchestrator — that means Plan 2 missed something.

**Files moved (with git rename history):**

- `src/features/camera-events/components/CameraEventDetailPage.tsx` → `src/features/camera-details/components/CameraEventDetailPage.tsx`
- `src/features/camera-events/components/CameraEventDetailPage.test.tsx` → `src/features/camera-details/components/CameraEventDetailPage.test.tsx`
- `src/features/camera-events/components/SnapshotLightbox.tsx` → `src/features/camera-details/components/SnapshotLightbox.tsx`
- `src/features/camera-events/components/SnapshotLightbox.test.tsx` → `src/features/camera-details/components/SnapshotLightbox.test.tsx`
- `src/features/camera-events/components/EventSnapshot.tsx` → `src/features/camera-details/components/EventSnapshot.tsx`
- `src/features/camera-events/components/InfoCard.tsx` → `src/features/camera-details/components/InfoCard.tsx`
- `src/features/camera-events/hooks/useBlobDownload.ts` → `src/features/camera-details/hooks/useBlobDownload.ts`

**Files edited:**

- `src/routes/_authenticated/camera-events.$id.tsx` (one import path)

**Files deleted:**

- `src/features/camera-details/components/.gitkeep`
- `src/features/camera-details/hooks/.gitkeep`

**Verification:**

```bash
bun run test -- CameraEventDetailPage SnapshotLightbox
bun run test
bun run lint
```

Both targeted runs and the full suite must pass.

**Commit message:**

```
refactor(camera-details): move detail-page UI components

Relocate CameraEventDetailPage, SnapshotLightbox, EventSnapshot, InfoCard,
and the useBlobDownload hook from camera-events/ into the new
camera-details/ feature. Update the /camera-events/:id route to import
CameraEventDetailPage from the new path. No behavior changes.
```

---

### Step 3 — Move the three Frigate proxy handlers

**Complexity:** standard (server-side code touched by live API routes; the
test files must still pass from the new location)

**Why third:** The proxy handlers are pure functions with their own unit
tests. Moving them is straightforward, but they are reached over HTTP via
the `src/routes/api/events/$id/*` files, so the route imports must be
updated in the same commit to keep the server starting cleanly.

**Pre-move sanity check (RED-equivalent):**

```bash
bun run test -- clip-proxy snapshot-proxy
```

Confirm both proxy test files pass from their current
`camera-events/server/` location.

**GREEN:**

1. `git mv src/features/camera-events/server/clip-proxy.ts \
src/features/camera-details/server/clip-proxy.ts`
2. `git mv src/features/camera-events/server/clip-proxy.test.ts \
src/features/camera-details/server/clip-proxy.test.ts`
3. `git mv src/features/camera-events/server/snapshot-proxy.ts \
src/features/camera-details/server/snapshot-proxy.ts`
4. `git mv src/features/camera-events/server/snapshot-proxy.test.ts \
src/features/camera-details/server/snapshot-proxy.test.ts`
5. `git mv src/features/camera-events/server/thumbnail-proxy.ts \
src/features/camera-details/server/thumbnail-proxy.ts`
6. Delete `src/features/camera-details/server/.gitkeep`.
7. Update API route imports:
   - `src/routes/api/events/$id/clip.ts`: replace
     `from '#/features/camera-events/server/clip-proxy'`
     with
     `from '#/features/camera-details/server/clip-proxy'`.
   - `src/routes/api/events/$id/snapshot.ts`: replace
     `from '#/features/camera-events/server/snapshot-proxy'`
     with
     `from '#/features/camera-details/server/snapshot-proxy'`.
   - `src/routes/api/events/$id/thumbnail.ts`: replace
     `from '#/features/camera-events/server/thumbnail-proxy'`
     with
     `from '#/features/camera-details/server/thumbnail-proxy'`.
8. No edits to the moved proxy source files are required: each one imports
   from `#/features/shared/server/frigate/{validation,client}` only, which
   stays valid from the new location. Each test file imports its sibling
   via `./clip-proxy` / `./snapshot-proxy` — those relative imports remain
   valid because the test moves with the source.

**REFACTOR:** None this step.

**Files moved:**

- `src/features/camera-events/server/clip-proxy.ts` → `src/features/camera-details/server/clip-proxy.ts`
- `src/features/camera-events/server/clip-proxy.test.ts` → `src/features/camera-details/server/clip-proxy.test.ts`
- `src/features/camera-events/server/snapshot-proxy.ts` → `src/features/camera-details/server/snapshot-proxy.ts`
- `src/features/camera-events/server/snapshot-proxy.test.ts` → `src/features/camera-details/server/snapshot-proxy.test.ts`
- `src/features/camera-events/server/thumbnail-proxy.ts` → `src/features/camera-details/server/thumbnail-proxy.ts`

**Files edited:**

- `src/routes/api/events/$id/clip.ts` (one import path)
- `src/routes/api/events/$id/snapshot.ts` (one import path)
- `src/routes/api/events/$id/thumbnail.ts` (one import path)

**Files deleted:**

- `src/features/camera-details/server/.gitkeep`

**Verification:**

```bash
bun run test -- clip-proxy snapshot-proxy
bun run test
bun run lint
bun run build
```

`build` is included here because route handler changes are the most likely
place to surface a missing-import-on-server error that unit tests miss.

**Commit message:**

```
refactor(camera-details): move clip, snapshot, and thumbnail proxies

Relocate clip-proxy, snapshot-proxy, and thumbnail-proxy (plus their
unit tests) from camera-events/server/ to camera-details/server/. Update
the three /api/events/:id/* route handlers to import from the new
location. URLs and response semantics are unchanged.
```

---

### Step 4 — Verify and tidy `camera-events/` directory

**Complexity:** trivial

**Why:** After Steps 2 and 3, the `camera-events/` feature should contain
only list-page concerns. Confirm this with a directory listing, remove any
now-empty subdirectories (e.g. `camera-events/hooks/` if it held only
`useBlobDownload`, or `camera-events/server/` if it held only the proxies),
and ensure no lingering imports cross the new boundary.

**RED-equivalent:** Run the grep checks listed below and observe that they
return no matches. If any match, the previous step missed a reference and
must be fixed before continuing.

**GREEN:**

1. From repo root, run these checks:

   ```bash
   # No file in camera-details should import from camera-events
   grep -r "features/camera-events" src/features/camera-details/ \
     && echo "FAIL: camera-details still imports from camera-events" \
     || echo "ok"

   # No file in camera-events should import from camera-details
   grep -r "features/camera-details" src/features/camera-events/ \
     && echo "FAIL: camera-events still imports from camera-details" \
     || echo "ok"

   # No file anywhere should still import any of the moved files via the
   # old camera-events path
   grep -rE "features/camera-events/(components/(CameraEventDetailPage|SnapshotLightbox|EventSnapshot|InfoCard)|hooks/useBlobDownload|server/(clip-proxy|snapshot-proxy|thumbnail-proxy))" src/ \
     && echo "FAIL: stale camera-events import" \
     || echo "ok"
   ```

2. Remove any empty directories left behind in `camera-events/` (e.g.
   `hooks/`, `server/`) using `git rm -r` only if they are truly empty and
   git is tracking emptiness via a `.gitkeep`. Otherwise leave them — empty
   dirs are not tracked by git on their own.

3. If `camera-events/hooks/` or `camera-events/server/` is empty after the
   moves, delete those directories from the working tree.

**REFACTOR:** None this step.

**Verification:**

```bash
bun run test
bun run lint
bun run build
```

**Commit message (only if there are actual deletions or grep-fix changes —
otherwise skip this commit and roll the doc update from Step 5 into Step 3
plus a fresh Step 4 covering only the docs):**

```
chore(camera-events): drop empty subdirectories after split

After moving detail-page components and proxy handlers to camera-details,
camera-events/hooks/ and camera-events/server/ no longer contain any
files. Remove them so the feature tree reflects the final list-only
scope.
```

If there is nothing to delete (because the directories were already empty
or git had nothing tracked there), skip this commit.

---

### Step 5 — Update `CLAUDE.md` feature map

**Complexity:** trivial

**Why:** The Feature Map table in `CLAUDE.md` is the canonical description
of the feature-sliced architecture. It must reflect the new four-feature
layout — `camera-events` narrowed to list-only, `camera-details` added as
the detail-page owner. Plan 2 was responsible for adding the `favorites`
row; Plan 1 was responsible for the `shared` row's expanded scope. This
step only touches the rows that Plan 3 affects.

**RED-equivalent:** Read the current `CLAUDE.md` Feature Map table (the
state after Plans 1 and 2 land) and confirm the `camera-events` row still
lists detail-page concerns (lightbox, proxies). That is the line we are
correcting.

**GREEN:**

1. Open `CLAUDE.md` and locate the Feature Map (`### Feature Map` heading).
2. Replace the `camera-events` row's "What it owns" cell so it reads:
   > Event list page, filter pills, events loading skeleton, mock data
3. Insert a new row directly after `camera-events`:

   | Feature          | Location                       | What it owns                                                                                                         |
   | ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
   | `camera-details` | `src/features/camera-details/` | Event detail page, snapshot lightbox, event snapshot, info card, blob download hook, clip/snapshot/thumbnail proxies |

4. Do not edit other rows. Specifically: leave the `favorites` and
   `shared` rows alone — Plans 1 and 2 own those.

**REFACTOR:** None.

**Files edited:**

- `CLAUDE.md`

**Verification:**

- Manually re-read the Feature Map to confirm the table is well-formed
  Markdown and that `camera-events` no longer claims detail-page or proxy
  ownership.
- `bun run lint` (no JS changes, but cheap to run).

**Commit message:**

```
docs(claude): update feature map for camera-details split

Narrow camera-events row to list-only scope and add a camera-details row
describing the detail page, lightbox, and proxy ownership.
```

---

### Step 6 — Final verification

**Complexity:** trivial

**Why:** Last safety net before the PR. Re-run the entire quality gate
locally and walk through each user-facing scenario from the spec to confirm
nothing regressed.

**Steps:**

1. Run the full quality gate:

   ```bash
   bun run test
   bun run lint
   bun run build
   ```

   All three must pass clean.

2. Start the dev server (`bun run dev`) and manually walk through these
   scenarios from the Gherkin in the spec:
   - Navigate to `/camera-events` — the list page renders, filter pills
     work, event cards render with thumbnails and timestamps.
   - Click an event from the list — the detail page renders with snapshot,
     camera name, label, duration, zones, and confidence bar.
   - Click the snapshot — the lightbox opens. Press Escape and the
     backdrop and confirm both close it.
   - With an event that has a clip, click the clip download link — the
     browser downloads `event-<id>.mp4` via `/api/events/:id/clip`.
   - With an event that has a snapshot, click the snapshot download link —
     the browser downloads `event-<id>.jpg` via
     `/api/events/:id/snapshot?download=true`.
   - Confirm the favorite button on the detail page still reflects and
     toggles favorite state (this exercises Plan 2's shared
     `FavoriteButton` / `useFavoriteToggle` from a `camera-details` host).

3. Run the directory-shape checks one more time to be sure:

   ```bash
   ls src/features/camera-events/components/   # only list-page files
   ls src/features/camera-events/data/         # mock-events files
   ls src/features/camera-details/components/  # all detail-page files
   ls src/features/camera-details/hooks/       # useBlobDownload.ts
   ls src/features/camera-details/server/      # three proxies + two tests
   ```

No commit in this step — it is a gate, not a change.

## Pre-PR Quality Gate

Before opening the PR, run the full pipeline from a clean tree:

```bash
bun run test         # all Vitest suites pass
bun run lint         # ESLint clean
bun run format       # Prettier check clean
bun run build        # production build succeeds, route tree regenerates
```

In addition:

1. Manual smoke test (listed under Step 6 above) confirms list page,
   detail page, lightbox, clip download, snapshot download, and favorite
   toggle behavior end-to-end on a running dev server.
2. `grep` checks from Step 4 return no stale `camera-events` paths
   referencing detail-page or proxy files.
3. `git log --stat` shows file moves as renames (not delete+add). If a
   move shows as delete+add, fix it before opening the PR with
   `git rm --cached` and `git add` against the new path; this preserves
   blame history.
4. Invoke `/code-review` and address any blocking findings before
   committing the final tip.

## Risks & Open Questions

**Risk: Plan 2's mock paths in `CameraEventDetailPage.test.tsx` are not
yet updated.** The test file currently uses `vi.mock('../hooks/useFavoriteToggle', ...)`
and `vi.mock('./FavoriteButton', ...)`. Plan 2 is expected to have rewritten
those to point at the shared module paths (`#/features/shared/...` or
similar). If for any reason Plan 2 did not touch those mocks, this plan's
Step 2 will fail because the mock paths would still resolve relative to
the new file location in `camera-details/`, and the modules they target
will not be there anymore. **Mitigation:** Step 2 explicitly calls out
this dependency and instructs the implementer to stop and escalate if the
mocks are still relative to `camera-events/` when Plan 3 starts.

**Risk: Production server fails to start due to a missed API route import
update.** The unit tests do not cover the route file imports — only the
proxy handler logic. If Step 3's edits to `clip.ts`, `snapshot.ts`, or
`thumbnail.ts` are incomplete, the server will start but the affected
endpoint will 500 at request time. **Mitigation:** Step 3 includes
`bun run build` in its verification block, and Step 6 includes a manual
clip-and-snapshot download smoke test against a live server.

**Risk: `git mv` shows up as delete+add in the diff.** If the implementer
edits the source file before doing the rename (or in a different working
tree than the rename) git may not detect the rename. **Mitigation:** Each
step lists the `git mv` commands first, then the edits to other files
(routes, CLAUDE.md). The Pre-PR Quality Gate item 3 explicitly checks
`git log --stat` for rename detection.

**Risk: Empty leftover directories in `camera-events/`.** Git does not
track empty directories, but they may persist in the working tree and
confuse the next developer. **Mitigation:** Step 4 explicitly looks for
`camera-events/hooks/` and `camera-events/server/` and deletes them from
the working tree if empty.

**Open question: Should `camera-details/` get an `index.ts` barrel
export?** The other features in this codebase do not use barrel files;
they expose their exports via direct file paths
(`#/features/<feature>/components/<Foo>`). Sticking with the existing
convention means **no barrel** — consistent with the rest of the
codebase. If a future plan introduces a barrel pattern, it can apply
that pattern to all features at once.

**Open question: Does the new feature need its own design doc?** Spec 3
in `docs/specs/feature-split-3-extract-camera-details-feature.md` already
documents the intent of the move and the resulting structure. A separate
design doc for `camera-details/` itself is not warranted — the feature
inherits the broader design from `docs/specs/feature-sliced-architecture.md`.
