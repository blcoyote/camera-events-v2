---
tags: [decision, auth, security]
created: 2026-07-07
---

# Login allow-list is managed in Google Cloud, not in app code

> Restricting _which_ Google accounts may sign in is handled at the Google
> OAuth / Google Cloud layer. This is intentional — do not flag the absence of
> an in-app allow-list as a security gap.

## Context

The OAuth callback (`src/routes/api/auth/google/callback.ts`) validates the ID
token (`iss`, `aud`, `exp`, `email_verified`) and then mints a session for the
returned Google `sub`. There is **no** in-app allow-list — no `ALLOWED_EMAILS`
env var, no `hd` hosted-domain check, no `sub` allow-list in
`parseIdTokenClaims`.

A security review (2026-07-07) flagged this: on its face, "authenticated" appears
to mean "anyone with a verified Google account who finds the URL," which for a
home camera app would be a broad access gate.

## Decision

This is **by design**. Access is restricted upstream in **Google Cloud** — the
OAuth consent screen / client is configured so only the intended accounts can
complete the Google login at all. The app deliberately does not duplicate that
allow-list in code or env.

## Why it matters

Future security passes will keep noticing the missing in-app allow-list and want
to "fix" it. Don't. The control exists, just not in this repo. Adding a second
allow-list in app code would be redundant and create two places to keep in sync.

If the access model ever changes (e.g. self-service public signup, or moving the
allow-list into the app), supersede this note.

## Related

- [[Home]]
- Server-function auth rule in `CLAUDE.md` (every `createServerFn` calls
  `requireSession()`)
