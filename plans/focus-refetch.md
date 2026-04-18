# Plan: Refetch on Focus / Notification Tap

**Spec:** [docs/specs/focus-refetch.md](../docs/specs/focus-refetch.md)
**Status:** implemented

## Steps

### 1. Create `useRefetchOnFocus` hook

**File:** `src/features/shared/hooks/useRefetchOnFocus.ts`

- Create a new hook that accepts `{ onRefresh, minIntervalMs }`.
- In `useEffect`, register a `visibilitychange` listener on `document`.
- When `document.visibilityState` becomes `'visible'`, check elapsed time since last refetch via a `useRef<number>` timestamp.
- If `minIntervalMs` (default 10,000ms) has passed, call `onRefresh()` and update the timestamp.
- Store `onRefresh` in a ref so the listener always has the latest callback.
- Clean up the listener on unmount.
- Initialize `lastRefetchRef` to `Date.now()` so a fresh page load doesn't immediately trigger a refetch.

**Acceptance criteria:** AC-5, AC-6, AC-7, AC-11

### 2. Integrate in Camera Events route

**File:** `src/routes/_authenticated/camera-events.index.tsx`

- Import `useRefetchOnFocus`.
- Call it in `CameraEventsRoute` with the same `onRefresh` callback used by pull-to-refresh: `clearCacheFn()` then `router.invalidate()`.

**Acceptance criteria:** AC-1, AC-3

### 3. Integrate in Cameras route

**File:** `src/routes/_authenticated/cameras.tsx`

- Import `useRefetchOnFocus`.
- Call it in `CamerasRoute` with the same `onRefresh` callback.

**Acceptance criteria:** AC-2

### 4. Write tests for `useRefetchOnFocus`

**File:** `src/features/shared/hooks/useRefetchOnFocus.test.ts`

- Test that `onRefresh` is called when `visibilitychange` fires with `document.visibilityState === 'visible'`.
- Test that `onRefresh` is NOT called when `visibilityState` is `'hidden'`.
- Test throttle: calling visibility change twice within `minIntervalMs` only triggers one refetch.
- Test that a second refetch fires after `minIntervalMs` has elapsed.
- Test that no refetch fires immediately on mount (fresh page load protection).

**Acceptance criteria:** AC-5, AC-6, AC-7

### 5. Manual cross-platform testing

- Test on iOS Safari standalone PWA: switch away and back, verify events refresh.
- Test on iOS Safari in-browser: same.
- Test on Android Chrome: same.
- Test notification tap on both iOS and Android while already on the events list.
- Verify pull-to-refresh still works without interference.
- Verify `pnpm build` succeeds with no hydration warnings.

**Acceptance criteria:** AC-4, AC-8, AC-9, AC-10, AC-11, AC-12

## Files Changed

| File                                                  | Change                       |
| ----------------------------------------------------- | ---------------------------- |
| `src/features/shared/hooks/useRefetchOnFocus.ts`      | New hook                     |
| `src/features/shared/hooks/useRefetchOnFocus.test.ts` | New tests                    |
| `src/routes/_authenticated/camera-events.index.tsx`   | Add `useRefetchOnFocus` call |
| `src/routes/_authenticated/cameras.tsx`               | Add `useRefetchOnFocus` call |
