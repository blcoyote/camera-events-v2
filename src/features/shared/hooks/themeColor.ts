export type Palette = 'ocean' | 'sunset' | 'slate'

export const PALETTES: readonly Palette[] = [
  'ocean',
  'sunset',
  'slate',
] as const

/**
 * Browser-chrome colors for `<meta name="theme-color">`, keyed by palette and
 * resolved mode. Kept in sync with the inline FOUC map in `__root.tsx` and the
 * palette token blocks in `styles.css`. light = the palette's ink tone, dark =
 * the palette's base background.
 */
const THEME_COLOR_MAP: Record<Palette, { light: string; dark: string }> = {
  ocean: { light: '#173a40', dark: '#0d1f23' },
  sunset: { light: '#43281a', dark: '#0f0c0a' },
  slate: { light: '#1f2933', dark: '#0d0f12' },
}

/**
 * Sync `<meta name="theme-color">` from the current DOM state. Both the theme
 * (mode) and palette stores call this after mutating `<html>`, so the DOM is
 * the single source of truth and the two stores never race on the tag.
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
