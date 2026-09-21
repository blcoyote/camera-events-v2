---
tags: [decision, auth, security, sqlite]
created: 2026-09-21
---

# Users table keyed by Google `sub`, with a fail-closed `is_admin` flag

> The app now persists a user record. `is_admin` defaults to false and is read
> through one coercion helper, so null, a missing row and anything unexpected
> all mean "not an admin". Admins are seeded one-way from `ADMIN_EMAILS`.

## Context

Before this, there was **no user record anywhere**. Identity lived only in the
encrypted `google-sso` session cookie (`sub`, `firstName`, `email`,
`avatarUrl`), and the three SQLite tables — `push_subscriptions`,
`push_notification_preferences`, `event_favorites` — each carried a bare
`user_id TEXT NOT NULL` holding the Google `sub` with no table behind it and no
foreign keys.

That was fine while the app had exactly one permission tier. Adding an admin
role broke the assumption: a role cannot live in the session cookie alone,
because the cookie is client-held, expires on a 7-day TTL and is reissued on
every login, leaving nowhere to record something an operator can inspect or
change.

## Decision

A `users` table in `data/camera-events.db`, owned by
`src/features/shared/server/users/user-store.ts`:

```sql
CREATE TABLE IF NOT EXISTS users (
  sub           TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  first_name    TEXT,
  avatar_url    TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Four rules hold this together:

1. **`sub` is the primary key**, not a synthetic autoincrement id. Every other
   table already joins on `sub`, so an extra indirection would buy nothing and
   make a future migration to real foreign keys more expensive.
2. **`is_admin` is `NOT NULL DEFAULT 0`, and every read goes through
   `toIsAdmin(value: unknown): boolean`** — only `1`, `'1'` or `true` are
   admin. The column makes a `NULL` unwritable; the helper covers the case the
   column cannot, namely a valid session cookie with no matching row (a wiped
   `ce-v2-data` volume). Both directions land on false.
3. **`upsertUser()` omits `is_admin` and `created_at` from its
   `ON CONFLICT(sub) DO UPDATE` clause.** It runs on every sign-in, so
   including them would silently demote every admin at their next login. This
   has a dedicated regression test, verified by temporarily breaking the SQL
   and watching the test fail.
4. **Promotion is one-way.** `promoteToAdmin()` is an `UPDATE` that never
   inserts, so an unknown `sub` stays unknown. A non-matching email leaves the
   stored value alone rather than demoting. Demotion is explicit, via
   `setAdmin(sub, false)`.

Admins are bootstrapped from a comma-separated `ADMIN_EMAILS` env var, matched
against the **verified** email from the Google ID token, after the existing
`email_verified` check in the OAuth callback. Matching is exact and
case-insensitive with no wildcards; unset or empty parses to an empty
allowlist, so a misconfigured deploy yields no admins rather than everyone.

The callback records the login in **its own try/catch**, before the session
write. A SQLite failure logs a warning and the sign-in proceeds. This is
deliberate: push and favorites both already fail soft, and making login the one
thing that breaks when the database is unwritable would be a new availability
coupling for no security gain — an unrecorded user simply reads as non-admin.

## Alternatives

1. **`ADMIN_EMAILS` only, no table, role stamped on the session cookie.**
   Cheapest, but admin status could then change only by redeploy, there would be
   no server-side record to query or audit, and an authz decision in a
   client-held cookie is the wrong shape even when encrypted and `httpOnly`.
   Kept as the _bootstrap_ mechanism, rejected as the _store_.
2. **Reuse `push_notification_preferences`** with `category = 'role'`. Rejected
   — puts authorization data in a push-notification table, and leans on that
   table's nullable-`resource_id` uniqueness semantics for a security flag.
3. **First user to sign in becomes admin.** Rejected — races on concurrent
   sign-in and silently grants admin to whoever arrives first after a volume
   reset.
4. **Synthetic `id INTEGER PRIMARY KEY AUTOINCREMENT`** to match the other
   tables' shape. Rejected — see rule 1.
5. **Let a DB failure fail the login** (fall into the outer catch and redirect
   to `/?error=login_failed`). Rejected — see the availability argument above.

## Why it matters

Two traps a future reader would otherwise walk into.

**`ADMIN_EMAILS` is not a sign-in allowlist, and does not contradict
[[decisions/2026-07-07-login-allowlist-in-google-cloud]].** That decision says
_who may sign in_ is controlled in Google Cloud and must not be duplicated in
app code. This answers a different question — which already-authorized account
holds the admin role — which Google Cloud cannot express, because it gates
authentication and knows nothing about this app's roles. Being listed in
`ADMIN_EMAILS` grants no access on its own; you still have to pass the
Google-side gate.

**Nothing consumes `is_admin` yet.** The flag is written and readable, but no
route, server function or UI branches on it. Anything that starts to must call
`store.isAdmin(sub)` server-side after `requireSession()` — never trust a
client-supplied claim, and never add the flag to the session cookie as a
shortcut, which would reintroduce alternative 1 through the back door.

## Related

- [[Home]]
- [[decisions/2026-07-07-login-allowlist-in-google-cloud]] — sign-in access, the
  separate concern this does not touch
- [[decisions/2026-04-28-runtime-portable-sqlite-driver]] — the Node/Bun driver
  this store opens through
- [[decisions/2026-04-14-server-function-authentication]] — the
  `requireSession()` rule any future admin gate sits on top of
- `docs/specs/user-table-admin-flag.md` — the fuller design write-up
