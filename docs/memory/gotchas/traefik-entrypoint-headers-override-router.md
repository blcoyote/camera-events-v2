---
tags: [gotcha, deployment, traefik, security-headers]
created: 2026-11-05
---

# ⚠️ Traefik entrypoint headers override the app's router headers

> The `websecure` entrypoint's `secure-headers@file` (portainer-traefik repo) wins over
> any header the `ce2-sec` router middleware also sets.

## Context

The 2026-11-05 security review saw a live HSTS header of only `max-age=31536000`, while
`docker-compose.yml` set `stsIncludeSubdomains` and `stsPreload`. X-Frame-Options and
Referrer-Policy were also the shared values (`SAMEORIGIN`, `same-origin`), not the
app's (`DENY`, `strict-origin-when-cross-origin`).

## What we know / decided

- `portainer-traefik/traefik/traefik.yml` applies `geoblock`, `crowdsec` and
  `secure-headers` to every router on `websecure`. Entrypoint middleware wraps router
  middleware, so for a header both set, the entrypoint's value is what the browser gets.
- `secure-headers` owns HSTS (with `includeSubDomains`, no `preload`),
  X-Content-Type-Options, X-Frame-Options and Referrer-Policy. Those labels were removed
  from both compose files.
- `ce2-sec` keeps only what the shared middleware does not set: CSP, Permissions-Policy,
  COOP and CORP. CSP's `frame-ancestors 'none'` is the effective framing control.
- No `preload`: the preload list only takes the registrable domain (`elcoyote.dk`),
  which would force HTTPS on every `*.elcoyote.dk` host.

## Why it matters

A header added to the compose labels that `secure-headers` also sets is silently ignored.
Change it in the portainer-traefik repo instead, and check the live response with
`curl -sI https://ce2.elcoyote.dk/`.

## Related

- [[Home]]
