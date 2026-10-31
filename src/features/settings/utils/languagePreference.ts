export type LanguageChoice = 'en' | 'da'

const COOKIE = 'PARAGLIDE_LOCALE'

/** Explicit language choice stored by Paraglide, or null for Automatic. Client-only. */
export function readStoredLanguage(): LanguageChoice | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
  return match?.[1] === 'en' || match?.[1] === 'da' ? match[1] : null
}

export function clearStoredLanguage(): void {
  document.cookie = `${COOKIE}=; Max-Age=0; path=/`
}

export function reloadPage(): void {
  window.location.reload()
}
