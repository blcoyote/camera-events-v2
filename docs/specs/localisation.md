# Spec: English and Danish Localisation

## Intent Description

The household is Danish and some members are not technical. The app currently
speaks only English and formats dates the American way in two places. This
feature makes the whole app, including push notifications, available in English
and Danish. The language follows the device's system language by default:
any `da*` locale gives Danish and everything else gives English. A per-device
override lives in Settings → Appearance. Dates, times and numbers follow Danish
conventions in both languages: day-month order, 24-hour clock, Europe/Copenhagen
time.

Decisions were settled in a grilling session on 2026-10-31 and are recorded in
`docs/memory/decisions/2026-10-31-paraglide-localisation.md`.

## Scope

**In scope**

- All UI copy in `src/features/**` and `src/routes/**`, including `aria-label`,
  `sr-only` text, `<title>` and empty, loading and error states.
- Known Frigate labels (`person`, `car`, …).
- Push notification title and body, both server-built and service-worker-merged.
- User-visible server errors, which become stable codes translated on the client.
- Date, time, number and percentage formatting.
- A Language control in Settings → Appearance (Automatic / English / Dansk).

**Out of scope**

- Camera names, which come from Frigate and are shown as-is.
- The web manifest, which stays a single static "Camera Events" manifest.
- Localised URLs, which stay the same for every language.
- Languages other than English and Danish.
- Log messages, comments and internal API field names.

## Locale resolution

| Where                                      | Order                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Server (SSR, server functions, API routes) | `PARAGLIDE_LOCALE` cookie → `Accept-Language` (`preferredLanguage`) → `en` |
| Client                                     | `<html lang>` written by the server (cookie already applied) → `en`        |
| Push delivery (MQTT pipeline, no request)  | The locale stored on each push subscription; `en` when absent              |

- The client never re-decides. `src/i18n/client-locale.ts` overwrites
  `getLocale` in the browser to return `document.documentElement.lang`, the
  server's decision, so server and client cannot disagree and hydration stays
  clean. This also bypasses Paraglide's first-call `setLocale`, which would
  otherwise write the `PARAGLIDE_LOCALE` cookie for a year and silently pin
  "Automatic" to the first language a device saw.
- The Paraglide strategy is `['cookie', 'preferredLanguage', 'baseLocale']`
  (server only in effect).
- The inlang message-format plugin is a devDependency loaded from
  `./node_modules`, not a CDN, so compiling needs no network.
- The `preferredLanguage` strategy matches exact tags first, then the base
  language, in the browser's preference order. `da-DK` therefore gives `da`, and
  `nb-NO` gives `en`.
- **Override:** Automatic deletes the cookie and reloads. English or Dansk calls
  `setLocale(x)`, which writes the cookie and reloads.
- **iOS:** Safari and the installed home-screen app each have their own cookie
  jar, so each keeps its own override. This is accepted and documented, not
  worked around.

## Formatting

|               | English (`en`)       | Danish (`da`)         |
| ------------- | -------------------- | --------------------- |
| Intl locale   | `en-GB`              | `da-DK`               |
| Date and time | `31 Oct 2026, 21:40` | `31. okt. 2026 21.40` |
| Time only     | `21:40`              | `21.40`               |
| Percent       | `87%`                | `87 %`                |
| Time zone     | `Europe/Copenhagen`  | `Europe/Copenhagen`   |

- All formatting goes through `src/features/shared/utils/intl.ts`, which exports
  `intlLocale(locale)` and the format helpers, each taking an
  explicit locale. No other file calls `toLocale*String` or
  `new Intl.*Format`.
- The admin Mute countdown keeps `H:MM:SS` and `M:SS` in both languages.

## Messages

- Paraglide JS: `@inlang/paraglide-js` with `project.inlang/settings.json`
  (`baseLocale: "en"`, `locales: ["en", "da"]`) and `messages/en.json` and
  `messages/da.json`.
- Compiled output goes to `src/paraglide/`, which is gitignored. It is generated
  by the Vite plugin (dev, build and Vitest) and by a `postinstall` compile
  script, so `tsc --noEmit` works on a fresh checkout and in CI.
- `emitTsDeclarations: false`. The project runs TypeScript 7, which doesn't
  ship the JavaScript compiler API that declaration emit needs. Types come from
  Paraglide's generated JSDoc instead, with `allowJs: true` in `tsconfig.json`.
- **Key naming:** `<feature>_<thing>` in snake_case, for example
  `settings_language_label`, `label_person` and `error_push_not_configured`.
- Plurals use Paraglide's plural variants, never string concatenation.
- **Tests** render in English by default. Danish tests call the
  `renderInLocale('da')` helper from `src/test-utils/locale.ts`, which overrides
  `getLocale` for the test and restores it afterwards.

## Labels

`translateLabel(label, locale)` in `src/features/shared/utils/labels.ts`
returns the translated name for the labels in Frigate's default label map that
the app shows (`person`, `car`, `dog`, `cat`, `bird`, `bicycle`, `motorcycle`,
`bus`, `truck`, `boat`, `horse`, `package`, `face`, `license_plate`). Any other
label falls back to the capitalised raw label. It replaces `formatLabelName` and
the server's `formatLabel`.

## Server errors

User-visible failures return `{ error: '<code>' }` with a stable snake_case
code, for example `push_not_configured`, `unauthorized`, `forbidden` and
`invalid_body`. The client maps each code to a message (`error_<code>`) and
falls back to `error_unknown`. HTTP status codes stay unchanged.

## Push notifications

- `push_subscriptions` gains a `locale TEXT NOT NULL DEFAULT 'en'` column,
  added idempotently on store open. Existing rows read as `en`.
- The subscribe endpoint accepts an optional `locale`. Anything other than `en`
  or `da` is rejected with `invalid_body`, because this is a trust boundary.
  When `locale` is omitted, a new row gets `en` and an existing row keeps its
  stored locale, so a re-registration without it never resets the language.
- `POST /api/push/locale` (`src/routes/api/push/locale.ts`, logic in
  `handleUpdateLocale`) reads the session user before parsing the body and
  returns 401 without one. It validates `endpoint` (an https URL) and `locale`
  (400 `invalid_body` otherwise), and updates only rows owned by that user.
- Delivery renders the title and body per subscription locale, with messages
  called with an explicit `{ locale }`. The payload carries `locale`, and the
  service worker uses it when merging, falling back to `en` when it is missing.
- **Sync:** `syncPushLocale` (`shared/utils/pushLocaleSync.ts`) posts to
  `/api/push/locale`.
  - When the device has an active subscription, the Language setting calls it
    before switching. The wait is capped at 3 s, so a slow network never blocks
    the switch.
  - `useSyncPushLocale` calls it on each app open.
  - Re-registering the subscription (on app open and when the app returns to
    the foreground) also sends the current locale.
  - The update is idempotent, so no client-side "last synced" bookkeeping is
    needed.

## Rollout

1. The foundation, formatting and per-feature string extraction land with the
   `preferredLanguage` strategy left out. Without a cookie everyone resolves
   to English, so Danish is invisible.
2. To test Danish during development, set `document.cookie = 'PARAGLIDE_LOCALE=da; Path=/'` (without `Path=/` the cookie is scoped to the current folder and missing from other routes).
3. Done: the final PR added `preferredLanguage` to the strategy and shipped the
   Language control (Settings → Appearance).

## Danish terms

The approved Danish terms live in `CONTEXT.md` under "Danish terms". Copy
chunks use them exactly.

## Acceptance

- `Accept-Language: da-DK,da;q=0.9` with no cookie: the HTML is Danish and
  `<html lang="da">`.
- `Accept-Language: nb-NO` gives English.
- A cookie overrides the header.
- There are no hydration warnings in either language.
- With the process running in `TZ=UTC`, an event at 02:12 UTC on 31 Oct 2026
  shows as `03:12` in English and `03.12` in Danish.
- A device subscribed in Danish receives Danish push text. A Patch merged by the
  service worker stays Danish.
- Changing the language in Settings updates the subscription's locale.
- iOS standalone, Android Chrome and desktop each behave the same way.
