import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  nextThemeMode,
  parseThemeMode,
  resolveThemeMode,
} from './themeMode'
import type { ResolvedTheme, ThemeMode } from './themeMode'

const DARK_QUERY = '(prefers-color-scheme: dark)'

let currentMode: ThemeMode = 'auto'
let hydrated = false
const listeners = new Set<() => void>()

function getSnapshot(): ThemeMode {
  return currentMode
}

function getServerSnapshot(): ThemeMode {
  return 'auto'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emitChange() {
  for (const listener of listeners) listener()
}

function readSystemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

function readStoredMode(): ThemeMode {
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    // Storage blocked or unavailable: fall back to auto.
    return 'auto'
  }
}

function setThemeStore(mode: ThemeMode) {
  currentMode = mode
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Persistence is best-effort.
  }
  applyResolvedTheme(resolveThemeMode(mode, readSystemPrefersDark()))
  emitChange()
}

/** Test-only: restore module state to its pristine, pre-hydration form. */
export function __resetThemeStoreForTests() {
  currentMode = 'auto'
  hydrated = false
  listeners.clear()
}

export function useTheme(): {
  mode: ThemeMode
  resolved: ResolvedTheme
  setTheme: (mode: ThemeMode) => void
  cycleTheme: () => void
} {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  // SSR-safe default; the real value is read after mount.
  const [prefersDark, setPrefersDark] = useState(false)

  useEffect(() => {
    if (!hydrated) {
      hydrated = true
      const stored = readStoredMode()
      if (stored !== currentMode) {
        currentMode = stored
        emitChange()
      }
    }
    const dark = readSystemPrefersDark()
    setPrefersDark(dark)
    applyResolvedTheme(resolveThemeMode(currentMode, dark))
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return
    const mql = window.matchMedia(DARK_QUERY)
    // The system may have changed while no listener was registered.
    setPrefersDark(mql.matches)
    const onChange = (e: { matches: boolean }) => {
      setPrefersDark(e.matches)
      applyResolvedTheme(e.matches ? 'dark' : 'light')
    }
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    // Older iOS Safari only supports the legacy MediaQueryList API.
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [mode])

  const setTheme = useCallback((next: ThemeMode) => setThemeStore(next), [])
  const cycleTheme = useCallback(
    () => setThemeStore(nextThemeMode(currentMode)),
    [],
  )

  return {
    mode,
    resolved: resolveThemeMode(mode, prefersDark),
    setTheme,
    cycleTheme,
  }
}
