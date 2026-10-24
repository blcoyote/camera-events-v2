/**
 * Pure theme-mode helpers. No React, no DOM, no window.
 * Values come from docs/specs/glassmorphism-dark-mode.md.
 */

export type ThemeMode = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

export const THEME_COLORS = {
  light: '#eef6ff',
  dark: '#0b1424',
} as const

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto']

/** Exact-match parse; anything that is not a known mode (including null) is 'auto'. */
export function parseThemeMode(raw: string | null): ThemeMode {
  return THEME_MODES.find((mode) => mode === raw) ?? 'auto'
}

/** Collapses 'auto' into a concrete theme using the system preference. */
export function resolveThemeMode(
  mode: ThemeMode,
  prefersDark: boolean,
): ResolvedTheme {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light'
  return mode
}

/** Cycle order: light → dark → auto → light. */
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  switch (mode) {
    case 'light':
      return 'dark'
    case 'dark':
      return 'auto'
    case 'auto':
      return 'light'
  }
}

/**
 * Applies a resolved theme to the document: swaps the `light`/`dark` class on
 * <html>, sets `color-scheme`, and syncs `<meta name="theme-color">` when present.
 * The `document` default is only evaluated at call time, so importing this
 * module on the server is safe.
 */
export function applyResolvedTheme(
  resolved: ResolvedTheme,
  doc: Document = document,
): void {
  const root = doc.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved

  const meta = doc.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved])
}
