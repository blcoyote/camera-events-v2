import { getLocale, overwriteGetLocale } from '#/paraglide/runtime.js'

type Locale = ReturnType<typeof getLocale>

/**
 * Makes Paraglide resolve `locale` until the returned restore fn is called.
 * Usage: `const restore = withLocale('da')` then `afterEach(restore)` or try/finally.
 */
export function withLocale(locale: Locale) {
  const original = getLocale
  overwriteGetLocale(() => locale)
  return () => overwriteGetLocale(original)
}
