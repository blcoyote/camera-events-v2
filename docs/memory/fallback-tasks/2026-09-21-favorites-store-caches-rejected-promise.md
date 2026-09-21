---
status: open
priority: normal
created: 2026-09-21
depends_on: []
---

# getFavoritesStore() caches a rejected promise forever

`getFavoritesStore()` in `src/features/shared/server/favorites/favorites-store.ts`
memoizes the store promise but never clears it on failure:

```ts
let _storePromise: Promise<FavoritesStore> | null = null

export function getFavoritesStore(): Promise<FavoritesStore> {
  if (!_storePromise) {
    _storePromise = createFavoritesStore() // <- a rejection is cached
  }
  return _storePromise
}
```

If `createFavoritesStore()` rejects once — transient DB open/init failure: full
disk, locked file, read-only volume — every later caller gets that same rejected
promise back, for the lifetime of the process, even after the database recovers.
Only a restart clears it.

`getPushStore()` (`src/features/push-notifications/server/push-store.ts:200-209`)
already has the correct pattern:

```ts
_storePromise = createPushStore(dbPath).catch((err) => {
  _storePromise = null
  throw err
})
```

## Fix

Apply the `getPushStore()` pattern to `getFavoritesStore()`. One-line change plus
a regression test: mock the sqlite module so the first `openSqlite` call rejects
and the second resolves, assert the first `getFavoritesStore()` rejects and a
second call then resolves. `user-store.test.ts` has this exact test to copy —
see the singleton describe block added on 2026-09-21.

## Why it is filed rather than fixed

Found while addressing a Copilot review on PR #126 (users table / `is_admin`),
which flagged the identical bug in the then-new `getUserStore()`. That one was
in the PR's own new code and was fixed there. This one is pre-existing on `main`
and unrelated to that diff, so fixing it would have widened the PR.

Note the same-shaped bug is now fixed in two of the three stores (`push-store`,
`user-store`); `favorites-store` is the last one. Worth grepping for
`_storePromise` when closing this, in case a fourth store has appeared since.

## Severity notes

Latent, not currently manifesting — it needs a transient DB failure to trigger.
But favorites sits on a user-facing read path, so when it does trigger the
symptom is the saved-events page failing until the process restarts, with
nothing pointing at the original one-off failure.

## Outcome

(filled in on close — what was done, or why it was closed without action)
