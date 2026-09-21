# Users Table with Admin Flag

## Problem

Until now this app had **no user record at all**. Identity existed only inside the
encrypted `google-sso` session cookie (`sub`, `firstName`, `email`, `avatarUrl`).
The three SQLite tables — `push_subscriptions`, `push_notification_preferences`
and `event_favorites` — each carry a bare `user_id TEXT NOT NULL` holding the
Google OpenID `sub`, with no table behind it and no foreign keys.

That was sufficient while the app had exactly one permission tier. The
[Google OAuth production allowlist spec](./google-oauth-production-allowlist.md)
explicitly listed _"per-user roles or permissions"_ as out of scope for the same
reason.

We now need to distinguish an **admin** from an ordinary authenticated user. A
role cannot live in the session cookie alone: the cookie is client-held, has a
7-day TTL, and is reissued on every login, so there would be nowhere to record a
role that outlives a session or that an operator can inspect and change.

## Approach

Introduce a real `users` table keyed by the Google `sub`, upserted at the OAuth
callback — the single chokepoint every sign-in already passes through — carrying
an `is_admin` flag alongside the profile fields the cookie already holds.

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

`sub` is the primary key rather than a synthetic autoincrement id, because it is
already the de-facto join key used by every other table in the database. This
keeps a future migration to real foreign keys cheap.

### `is_admin` is false unless proven true

The flag is stored as SQLite `INTEGER NOT NULL DEFAULT 0`, and **every** read
goes through a single coercion helper:

```ts
export function toIsAdmin(value: unknown): boolean // only 1 / '1' / true -> true
```

So admin-ness fails closed from both directions at once:

- the DDL makes it impossible to _write_ a `NULL`; and
- the reader still interprets `NULL`, `undefined`, `0`, `''`, a missing row, an
  unknown `sub`, and any unexpected type as **false**.

The redundancy is deliberate. A `NOT NULL` column alone would leave the
"no row for this `sub`" case — a valid session cookie against a wiped
`ce-v2-data` volume — to whatever the caller happened to do with `undefined`.
Routing every read through `toIsAdmin` means there is exactly one place where
the question "is this user an admin?" can be answered, and its default is no.

### Profile upsert must never touch the flag

`upsertUser()` runs on every sign-in and refreshes `email`, `first_name`,
`avatar_url` and `last_login_at`. Its `ON CONFLICT(sub) DO UPDATE` clause
deliberately omits `is_admin` and `created_at`. A regression here would silently
demote every admin on their next login, which is why it carries a dedicated
test.

### Bootstrapping the first admin

A fresh database has every user at `is_admin = 0` and no way to become one. We
seed from a comma-separated `ADMIN_EMAILS` env var, checked against the
**verified** email from the Google ID token at the callback (after the existing
`email_verified` check, so an unverified address can never promote itself).

Promotion is **one-way**: a matching email calls `promoteToAdmin(sub)`, a plain
`UPDATE`. A non-matching email leaves the stored value untouched rather than
demoting. This means removing an address from `ADMIN_EMAILS` does not revoke
admin — deliberate, so that a redeploy with a truncated env var cannot silently
strip access, and so that a manual `setAdmin(sub, true)` survives the next
login. Demotion is explicit, via `setAdmin(sub, false)`.

Matching is exact and case-insensitive, with no substring, prefix, suffix or
domain-wildcard matching — `evil-admin@x.com` must not match `admin@x.com`.
An unset or empty `ADMIN_EMAILS` parses to an empty allowlist, so a misconfigured
deploy yields no admins rather than everyone.

**`ADMIN_EMAILS` is not a sign-in allowlist.** A standing decision
(`docs/memory/decisions/2026-07-07-login-allowlist-in-google-cloud.md`) says
_who may sign in_ is controlled in Google Cloud and must not be duplicated in
app code, and this does not revive that. `ADMIN_EMAILS` answers a different
question — which of the already-authorized accounts holds the admin role — and
Google Cloud has no way to express that, since it gates authentication and
knows nothing about this app's roles. Everyone in `ADMIN_EMAILS` must still pass
the Google-side gate to sign in at all; being listed here grants no access on
its own.

## Alternatives Considered

1. **`ADMIN_EMAILS` env var only, no table, flag stamped onto the session
   cookie.** Rejected. Cheapest diff and composes with the existing allowlist
   spec, but admin status could then only change via redeploy, there would be no
   server-side record to audit or query, and a role living in a client-held
   cookie is the wrong place for an authz decision even when the cookie is
   encrypted and `httpOnly`. Retained only as the _bootstrap_ mechanism.
2. **Reuse `push_notification_preferences`** with `category = 'role'`,
   `resource_id = 'admin'`. Rejected — overloads a push-notification table with
   authorization data, and that table's `UNIQUE(user_id, category, resource_id)`
   constraint has nullable-`resource_id` semantics we would rather not depend on
   for an authz flag.
3. **First user to sign in becomes admin.** Rejected — races if two people sign
   in concurrently, and silently grants admin to whoever arrives first after a
   volume reset.
4. **Synthetic `id INTEGER PRIMARY KEY AUTOINCREMENT` with `sub` as a unique
   column**, matching the other tables' shape. Rejected — the other tables join
   on `sub` already, so an extra indirection buys nothing today.

## Scope

### In scope

- `users` table and `src/features/shared/server/users/user-store.ts`.
- `toIsAdmin` coercion helper; `isAdmin` / `setAdmin` / `promoteToAdmin` reads
  and writes.
- `src/features/auth/server/admin-emails.ts` — pure `ADMIN_EMAILS` parsing and
  matching.
- Upsert + conditional promotion wired into
  [the OAuth callback](../../src/routes/api/auth/google/callback.ts).
- New `ADMIN_EMAILS` env var, documented in `.env.example` and `CLAUDE.md`.

### Out of scope

- Any feature that _consumes_ `is_admin` — no admin UI, no gated routes, no
  admin-only server functions. The flag is currently written and readable but
  nothing branches on it.
- Exposing `isAdmin` on the session / `context.user` via `getCurrentUserFn`.
- Foreign keys from the existing `user_id` columns to `users.sub`, and
  backfilling `users` rows for the `sub` values already present in those tables.
- Admin UI for managing `ADMIN_EMAILS` or for promoting users.
- Any in-app sign-in allowlist. The `ALLOWED_EMAILS` idea sketched in
  [the OAuth production spec](./google-oauth-production-allowlist.md) was
  deliberately **rejected** — see
  `docs/memory/decisions/2026-07-07-login-allowlist-in-google-cloud.md`. Who may
  sign in is controlled upstream in Google Cloud and must not be duplicated here.
