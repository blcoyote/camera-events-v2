export type Palette = 'ocean' | 'sunset' | 'slate'

export const PALETTES: readonly Palette[] = [
  'ocean',
  'sunset',
  'slate',
] as const

/**
 * Browser-chrome color for `<meta name="theme-color">`, keyed by palette and
 * resolved mode. This is the single source of truth: the inline FOUC script in
 * `__root.tsx` is generated from this object, so the two cannot drift. Values
 * are the chrome tone per palette × mode — light = the ink tone; dark = a
 * near-background tone (ocean keeps its original #0d1f23, intentionally a touch
 * lifted from its #0e0e0e page background).
 */
export const THEME_COLOR_MAP: Record<Palette, { light: string; dark: string }> =
  {
    ocean: { light: '#173a40', dark: '#0d1f23' },
    sunset: { light: '#43281a', dark: '#0f0c0a' },
    slate: { light: '#1f2933', dark: '#0d0f12' },
  }

/**
 * Sync `<meta name="theme-color">` from current DOM state: palette from the
 * `data-palette` attribute, resolved mode from the `.dark` class (which
 * `useTheme` owns — `usePalette` relies on it being present). Both stores call
 * this after mutating `<html>`. Deriving from the DOM rather than store-local
 * values keeps the write idempotent, so whichever store writes last produces
 * the same correct value.
 */
export function syncThemeColorMeta() {
  const root = document.documentElement
  const attr = root.getAttribute('data-palette')
  const palette: Palette =
    attr === 'sunset' || attr === 'slate' ? attr : 'ocean'
  const resolved = root.classList.contains('dark') ? 'dark' : 'light'

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLOR_MAP[palette][resolved])
  }
}
