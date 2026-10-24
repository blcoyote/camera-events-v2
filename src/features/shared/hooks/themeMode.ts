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
