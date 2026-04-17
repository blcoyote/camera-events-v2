import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type ThemeMode = 'light' | 'dark' | 'auto'

const THEME_COLORS = { light: '#173a40', dark: '#0d1f23' } as const

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }

  document.documentElement.style.colorScheme = resolved

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[resolved])
  }
}

let currentMode: ThemeMode = 'auto'
const listeners = new Set<() => void>()

function getSnapshot(): ThemeMode {
  return currentMode
}

function getServerSnapshot(): ThemeMode {
  return 'auto'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function setThemeStore(nextMode: ThemeMode) {
  currentMode = nextMode
  applyThemeMode(nextMode)
  window.localStorage.setItem('theme', nextMode)
  emitChange()
}

export function useTheme() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    const stored = window.localStorage.getItem('theme')
    const initial: ThemeMode =
      stored === 'light' || stored === 'dark' || stored === 'auto'
        ? stored
        : 'auto'

    if (initial !== currentMode) {
      currentMode = initial
      applyThemeMode(initial)
      emitChange()
    } else {
      applyThemeMode(initial)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('auto')

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode])

  const setTheme = useCallback((nextMode: ThemeMode) => {
    setThemeStore(nextMode)
  }, [])

  const cycleTheme = useCallback(() => {
    const next: ThemeMode =
      currentMode === 'light'
        ? 'dark'
        : currentMode === 'dark'
          ? 'auto'
          : 'light'
    setThemeStore(next)
  }, [])

  return { mode, setTheme, cycleTheme } as const
}
