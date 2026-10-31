---
tags: [decision, i18n, localisation, push]
created: 2026-10-31
---

# English and Danish localisation with Paraglide JS

> The app ships in English and Danish via Paraglide JS. The language follows
> the device's system language and can be overridden per device with a cookie.
> Formatting is `en-GB` / `da-DK` in Europe/Copenhagen time. Push notifications
> render in each subscription's stored locale.

## Context

The household is Danish and PRODUCT.md previously said "English only, no
localisation planned". The user asked for English and Danish, selected by the
system language with English as the fallback, and Danish conventions for dates
and units. Status: planned. The full design is in `docs/specs/localisation.md`.

## Decision

- **Library:** Paraglide JS (`@inlang/paraglide-js`), with compiled messages in
  `messages/{en,da}.json`. The generated `src/paraglide/` is gitignored and
  compiled by both the Vite plugin and `postinstall`.
- **Resolution on the server:** cookie → `Accept-Language` → `en`, via
  `paraglideMiddleware` wrapping the fetch handler in `src/server.ts`.
- **Resolution on the client:** cookie → the server-written `<html lang>` →
  `en`. A custom client strategy keeps the client from re-deciding the
  language, so server and client always match.
- **URLs:** no locale in the URL.
- **Override:** the `PARAGLIDE_LOCALE` cookie is per device. On iOS, Safari and
  the installed app each keep their own.
- **Formatting:** `en-GB` for English, `da-DK` for Danish, both in
  `Europe/Copenhagen`, centralised in `shared/utils/intl.ts`.
- **Frigate labels:** known labels are translated; unknown ones fall back to
  the capitalised raw label. Camera names are untranslated.
- **Server errors:** endpoints return stable codes, and the client translates
  them.
- **Push:** `push_subscriptions.locale` (default `en`). It is synced when the
  language changes and on each app open. The payload carries the locale so the
  service worker merges in the same language.
- **Manifest:** stays a single static "Camera Events" manifest.

## Alternatives

- **A hand-rolled typed dictionary.** Smallest, but the user chose Paraglide for
  compiled, tree-shaken messages and plural support.
- **i18next.** Rejected as heavier, with runtime loading and SSR setup.
- **A `/da/` URL prefix.** Rejected: it breaks links shared between family
  members whose devices are set to different languages.
- **Device time zone.** Rejected: events happen at home, and the server's time
  zone can't be known during SSR.
- **The service worker localising via `navigator.language`.** Rejected: it
  can't see the cookie override.
- **Storing the language per account.** Rejected: it needs a database lookup on
  every render, and a device cookie is enough.

## Why it matters

- **TypeScript 7 lacks the JavaScript compiler API** (see
  [[decisions/2026-10-31-typescript-7-and-biome]]), so Paraglide's
  `emitTsDeclarations` is off. Message types come from generated JSDoc, with
  `allowJs`.
- **The MQTT push pipeline runs outside any request,** so there is no
  AsyncLocalStorage locale. Every message call there must pass `{ locale }`
  explicitly.

## Related

- [[Home]]
- [[decisions/2026-10-13-app-owned-session-cookie]]
