import {
  baseLocale,
  isLocale,
  overwriteGetLocale,
} from '#/paraglide/runtime.js'

// In the browser the locale is whatever the server rendered into <html lang>
// (it already applied cookie → Accept-Language → en), so hydration matches.
// Overwriting getLocale also skips Paraglide's first-call cookie write, which
// would otherwise pin "Automatic" to the first language a device saw.
if (typeof document !== 'undefined') {
  overwriteGetLocale(() => {
    const lang = document.documentElement.lang
    return isLocale(lang) ? lang : baseLocale
  })
}
