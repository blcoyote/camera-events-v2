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

/**
 * Builds the blocking inline script that applies the stored theme before first
 * paint. It runs before any module code, so it is self-contained ES5 that only
 * touches window globals, and mirrors parseThemeMode / resolveThemeMode /
 * applyResolvedTheme. Any failure is swallowed so it can never break the page.
 */
export function buildThemeInitScript(): string {
  // Escape '<' so an interpolated value can never form '</script' in the page.
  const json = (value: unknown) =>
    JSON.stringify(value).replace(/</g, '\\u003c')
  return (
    '(function(){try{' +
    'var m=localStorage.getItem(' +
    json(THEME_STORAGE_KEY) +
    ");if(m!=='light'&&m!=='dark'&&m!=='auto')m='auto';" +
    "var d=m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);" +
    "var r=d?'dark':'light';" +
    'var h=document.documentElement;' +
    "h.classList.remove('light','dark');h.classList.add(r);h.style.colorScheme=r;" +
    'var c=' +
    json(THEME_COLORS) +
    ';' +
    'var t=document.querySelector(\'meta[name="theme-color"]\');' +
    "if(t)t.setAttribute('content',c[r])" +
    '}catch(e){}})();'
  )
}
