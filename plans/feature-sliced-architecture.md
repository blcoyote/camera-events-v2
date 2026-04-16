# Plan: Vertical Feature-Sliced Architecture Refactor

**Created**: 2026-04-15
**Branch**: main
**Status**: implemented
**Spec**: [docs/specs/feature-sliced-architecture.md](../docs/specs/feature-sliced-architecture.md)

## Goal

Restructure the codebase from a technical-role layout (`components/`, `hooks/`, `pages/`, `server/`, `data/`) into vertical feature slices under `src/features/`. Each feature owns all its code. No cross-feature imports — shared code lives in `src/features/shared/`. Route files stay in `src/routes/` and serve as the composition layer.

## Acceptance Criteria

- [x] AC-1: All source files are relocated to `src/features/<feature>/` according to the spec's file mapping
- [x] AC-2: No feature imports from another feature (only from `shared/` or external packages)
- [x] AC-3: `pnpm tsc --noEmit` passes with zero type errors
- [x] AC-4: `pnpm test` passes — all 366 tests pass across 41 files without assertion changes
- [x] AC-5: `pnpm build` completes successfully
- [ ] AC-6: `pnpm dev` starts and the route tree regenerates correctly
- [x] AC-7: Old directories (`src/components/`, `src/hooks/`, `src/pages/`, `src/data/`, `src/server/`) are deleted
- [x] AC-8: Route files under `src/routes/` have not been moved, only import paths updated
- [x] AC-9: Storybook stories resolve and render (verified via vitest storybook tests — all 30 story tests pass)
- [x] AC-10: No circular dependencies exist between features (verified via grep — zero cross-feature imports)

## Migration Strategy

**Approach**: Bottom-up, leaf-first. Move shared infrastructure first (no dependents to update), then features from least to most connected. After each step, verify with `pnpm tsc --noEmit`.

**Commit strategy**: One commit per step to keep changes reviewable and revertable.

---

## Step 1: Create `shared` — Frigate client, session, MediaCard, AlertBanner, useEventLimit

**Why first**: Every other feature depends on shared code. Moving this first means subsequent feature moves only need to update imports to `#/features/shared/...`.

### 1a. Move `src/server/frigate/` → `src/features/shared/server/frigate/`

Move the entire directory (types, config, client, cache, mock-client, validation, assets, and all tests). Internal imports within the frigate directory are relative and won't break.

**Files to move** (9 source + tests + asset):

- `types.ts`, `config.ts`, `config.test.ts`, `client.ts`, `client.test.ts`, `cache.ts`, `cache.test.ts`, `mock-client.ts`, `mock-client.test.ts`, `validation.ts`, `validation.test.ts`, `assets/placeholder.jpeg`

**Import updates needed**:

- `src/server.ts` (server entry): does not import frigate directly — no change
- All other importers will be updated when their own feature moves in later steps

### 1b. Move `src/server/session.ts` → `src/features/shared/server/session.ts`

Also move `session.test.ts`.

### 1c. Move `src/components/MediaCard.tsx` → `src/features/shared/components/MediaCard.tsx`

### 1d. Move `src/components/AlertBanner.tsx` → `src/features/shared/components/AlertBanner.tsx`

Also move `AlertBanner.test.ts` and `AlertBanner.stories.tsx`.

### 1e. Move `src/hooks/useEventLimit.ts` → `src/features/shared/hooks/useEventLimit.ts`

Also move `useEventLimit.test.ts`.

**Checkpoint**: `pnpm tsc --noEmit` — expect errors in files that still import from old locations (they will be fixed in subsequent steps).

---

## Step 2: Move `auth` feature

Move server-side auth modules into `src/features/auth/server/`.

**Files to move**:

- `src/server/auth.ts` → `src/features/auth/server/auth.ts`
- `src/server/auth.test.ts` → `src/features/auth/server/auth.test.ts`
- `src/server/auth-crypto.ts` → `src/features/auth/server/auth-crypto.ts`
- `src/server/google-oauth.ts` → `src/features/auth/server/google-oauth.ts`
- `src/server/google-oauth.test.ts` → `src/features/auth/server/google-oauth.test.ts`

**Import updates**:

- `auth.ts`: update `./session` → `#/features/shared/server/session`
- `auth-crypto.ts`: update `./session` → `#/features/shared/server/session`
- `google-oauth.ts`: update `./session` → `#/features/shared/server/session`
- `src/routes/__root.tsx`: update `../server/auth` → `#/features/auth/server/auth`
- `src/routes/api/auth/google.ts`, `google/callback.ts`, `logout.ts`: update auth import paths

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 3: Move `push-notifications` feature (server-only)

Move all server-side push/mqtt modules into `src/features/push-notifications/server/`.

**Files to move**:

- `src/server/push.ts` → `src/features/push-notifications/server/push.ts`
- `src/server/push.test.ts` → `src/features/push-notifications/server/push.test.ts`
- `src/server/push-store.ts` → `src/features/push-notifications/server/push-store.ts`
- `src/server/push-store.test.ts` → `src/features/push-notifications/server/push-store.test.ts`
- `src/server/push-notify.ts` → `src/features/push-notifications/server/push-notify.ts`
- `src/server/push-notify.test.ts` → `src/features/push-notifications/server/push-notify.test.ts`
- `src/server/event-batcher.ts` → `src/features/push-notifications/server/event-batcher.ts`
- `src/server/event-batcher.test.ts` → `src/features/push-notifications/server/event-batcher.test.ts`
- `src/server/mqtt.ts` → `src/features/push-notifications/server/mqtt.ts`
- `src/server/mqtt.test.ts` → `src/features/push-notifications/server/mqtt.test.ts`
- `src/server/mqtt-cache.integration.test.ts` → `src/features/push-notifications/server/mqtt-cache.integration.test.ts`
- `src/routes/api/push/-push-handlers.ts` → `src/features/push-notifications/server/push-handlers.ts`

**Import updates**:

- `push.ts`: update `./push-store` → `./push-store` (stays relative within feature)
- `push-notify.ts`: update `./event-batcher`, `./push`, `./push-store` → relative (same feature dir)
- `mqtt.ts`: update `./frigate/cache` → `#/features/shared/server/frigate/cache`; update `./event-batcher`, `./push-notify` → relative
- `push-handlers.ts`: update `#/server/push` → `./push`; `#/server/push-store` → `./push-store`; `#/server/frigate/client` → `#/features/shared/server/frigate/client`
- `mqtt-cache.integration.test.ts`: update `./frigate/cache` → `#/features/shared/server/frigate/cache`
- `src/server.ts`: update `./server/mqtt` → `#/features/push-notifications/server/mqtt`
- `src/routes/api/push/*.ts`: update `-push-handlers` → `#/features/push-notifications/server/push-handlers`

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 4: Move `camera-events` feature

### 4a. Extract `camera-events/utils.ts`

Create `src/features/camera-events/utils.ts` with these functions extracted from `CameraEventsListPage.tsx`:

- `formatRelativeTime`
- `formatLabelName`
- `getLabelDotColor`
- `LABEL_DOT_COLORS`

### 4b. Move page components

- `src/pages/camera-events/CameraEventsListPage.tsx` → `src/features/camera-events/components/CameraEventsListPage.tsx`
- `src/pages/camera-events/CameraEventsListPage.stories.tsx` → `src/features/camera-events/components/CameraEventsListPage.stories.tsx`
- `src/pages/camera-events/CameraEventDetailPage.tsx` → `src/features/camera-events/components/CameraEventDetailPage.tsx`
- `src/pages/camera-events/CameraEventDetailPage.stories.tsx` → `src/features/camera-events/components/CameraEventDetailPage.stories.tsx`

### 4c. Move proxy handlers

- `src/routes/api/events/-clip-proxy.ts` → `src/features/camera-events/server/clip-proxy.ts`
- `src/routes/api/events/-clip-proxy.test.ts` → `src/features/camera-events/server/clip-proxy.test.ts`
- `src/routes/api/events/-snapshot-proxy.ts` → `src/features/camera-events/server/snapshot-proxy.ts`
- `src/routes/api/events/-snapshot-proxy.test.ts` → `src/features/camera-events/server/snapshot-proxy.test.ts`
- `src/routes/api/events/-thumbnail-proxy.ts` → `src/features/camera-events/server/thumbnail-proxy.ts`

### 4d. Move mock data

- `src/data/camera-events.ts` → `src/features/camera-events/data/mock-events.ts`
- `src/data/-camera-events.test.ts` → `src/features/camera-events/data/mock-events.test.ts`

**Import updates**:

- `CameraEventsListPage.tsx`: update `../../components/MediaCard` → `#/features/shared/components/MediaCard`; update `../../server/frigate/config` → `#/features/shared/server/frigate/config`; update `../../server/frigate/types` → `#/features/shared/server/frigate/types`; remove exported utils (now in `../utils`)
- `CameraEventDetailPage.tsx`: update `./CameraEventsListPage` utils import → `../utils`; update server type imports → `#/features/shared/...`
- Proxy handlers: update `#/server/frigate/...` → `#/features/shared/server/frigate/...`
- Mock data: update `../server/frigate/types` → `#/features/shared/server/frigate/types`
- Route files (`camera-events.index.tsx`, `camera-events.$id.tsx`): update `#/pages/...` → `#/features/camera-events/components/...`; update `#/server/frigate/...` → `#/features/shared/server/frigate/...`; update `#/hooks/useEventLimit` → `#/features/shared/hooks/useEventLimit`
- API route files (`events/$id/clip.ts`, `snapshot.ts`, `thumbnail.ts`): update proxy handler imports → `#/features/camera-events/server/...`
- Story files: update mock data imports and decorator paths

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 5: Move `cameras` feature

- `src/pages/cameras/CamerasPage.tsx` → `src/features/cameras/components/CamerasPage.tsx`
- `src/pages/cameras/CamerasPage.stories.tsx` → `src/features/cameras/components/CamerasPage.stories.tsx`
- `src/routes/api/cameras/-snapshot-proxy.ts` → `src/features/cameras/server/snapshot-proxy.ts`
- `src/routes/api/cameras/-snapshot-proxy.test.ts` → `src/features/cameras/server/snapshot-proxy.test.ts`

**Import updates**:

- `CamerasPage.tsx`: update `#/components/MediaCard` → `#/features/shared/components/MediaCard`; update `#/server/frigate/config` → `#/features/shared/server/frigate/config`
- Snapshot proxy: update `#/server/frigate/...` → `#/features/shared/server/frigate/...`
- Route file (`cameras.tsx`): update `#/pages/cameras/...` → `#/features/cameras/components/...`; update `#/server/frigate/...` → `#/features/shared/server/frigate/...`
- API route file (`cameras/$name/latest.ts`): update proxy import → `#/features/cameras/server/snapshot-proxy`

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 6: Move `settings` feature

- `src/pages/settings/SettingsPage.tsx` → `src/features/settings/components/SettingsPage.tsx`
- `src/pages/settings/SettingsPage.stories.tsx` → `src/features/settings/components/SettingsPage.stories.tsx`
- `src/pages/settings/NotificationSettings.tsx` → `src/features/settings/components/NotificationSettings.tsx`
- `src/pages/settings/NotificationSettings.stories.tsx` → `src/features/settings/components/NotificationSettings.stories.tsx`
- `src/pages/settings/NotificationSettings.test.ts` → `src/features/settings/components/NotificationSettings.test.ts`
- `src/hooks/usePushSubscription.ts` → `src/features/settings/hooks/usePushSubscription.ts`
- `src/hooks/usePushSubscription.test.ts` → `src/features/settings/hooks/usePushSubscription.test.ts`

**Import updates**:

- `SettingsPage.tsx`: update `#/hooks/useEventLimit` → `#/features/shared/hooks/useEventLimit`
- `NotificationSettings.tsx`: update `#/hooks/usePushSubscription` → `../hooks/usePushSubscription`
- Route file (`settings.tsx`): update `#/pages/settings/...` → `#/features/settings/components/...`

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 7: Move `home` feature

- `src/pages/home/HomePage.tsx` → `src/features/home/components/HomePage.tsx`
- `src/pages/home/HomePage.stories.tsx` → `src/features/home/components/HomePage.stories.tsx`

**Import updates**:

- `HomePage.tsx`: update `../../components/AlertBanner` → `#/features/shared/components/AlertBanner`
- Route file (`index.tsx`): update `#/pages/home/...` → `#/features/home/components/...`

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 8: Move `shell` feature

- `src/components/Header.tsx` → `src/features/shell/components/Header.tsx`
- `src/components/Header.test.tsx` → `src/features/shell/components/Header.test.tsx`
- `src/components/Header.stories.tsx` → `src/features/shell/components/Header.stories.tsx`
- `src/components/Footer.tsx` → `src/features/shell/components/Footer.tsx`
- `src/components/Footer.stories.tsx` → `src/features/shell/components/Footer.stories.tsx`
- `src/components/ThemeToggle.tsx` → `src/features/shell/components/ThemeToggle.tsx`
- `src/components/ThemeToggle.stories.tsx` → `src/features/shell/components/ThemeToggle.stories.tsx`
- `src/components/ServiceWorkerRegistration.tsx` → `src/features/shell/components/ServiceWorkerRegistration.tsx`

**Import updates**:

- `Header.tsx`: update `./ThemeToggle` → `./ThemeToggle` (still relative, same dir); update `../server/session` → `#/features/shared/server/session`
- `src/routes/__root.tsx`: update all `../components/...` → `#/features/shell/components/...`; update `../server/auth` → `#/features/auth/server/auth`; update `../server/session` → `#/features/shared/server/session`

**Checkpoint**: `pnpm tsc --noEmit`

---

## Step 9: Update remaining route file imports

Review all route files for any remaining old-path imports:

- `src/routes/_authenticated.tsx`: update `../server/session` → `#/features/shared/server/session`
- `src/routes/index.tsx`: update `../server/session` → `#/features/shared/server/session`; update page import
- Route test files (`-authenticated.test.ts`, `-index.test.ts`, etc.): update session type imports

**Checkpoint**: `pnpm tsc --noEmit` — should now be zero errors.

---

## Step 10: Clean up old directories

Delete the now-empty directories:

- `src/components/` (should be empty)
- `src/hooks/` (should be empty)
- `src/pages/` (should be empty)
- `src/data/` (should be empty)
- `src/server/` (should be empty — only had modules that moved, `server.ts` at src root stays)

Verify nothing was missed by checking for leftover files.

---

## Step 11: Full verification

Run all checks to confirm zero regressions:

1. `pnpm tsc --noEmit` — type checking
2. `pnpm test` — all tests pass
3. `pnpm build` — production build succeeds
4. `pnpm dev` — dev server starts, route tree regenerates
5. `pnpm storybook` — stories render correctly
6. Manual smoke test: visit `/`, sign in, `/camera-events`, `/camera-events/<id>`, `/cameras`, `/settings`

---

## Step 12: Validate feature isolation

Verify no cross-feature imports exist. For each feature directory, grep for imports from other features:

```bash
# Should return zero results
grep -r "features/camera-events" src/features/cameras/ src/features/auth/ src/features/push-notifications/ src/features/settings/ src/features/home/ src/features/shell/
grep -r "features/cameras" src/features/camera-events/ src/features/auth/ src/features/push-notifications/ src/features/settings/ src/features/home/ src/features/shell/
# ... etc for each feature pair
```

---

## Estimated Scope

- **Files moved**: ~65 (source + test + story + asset files)
- **Import paths updated**: ~80–100 import statements across moved files and route files
- **New files created**: 1 (`camera-events/utils.ts` — extracted from existing code)
- **Files deleted**: 0 (files are moved, not deleted; empty dirs are removed)
- **Logic changes**: 0 — this is a pure structural refactor with no behavior changes
