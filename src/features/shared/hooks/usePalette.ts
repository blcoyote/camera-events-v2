import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { syncThemeColorMeta, PALETTES } from './themeColor'
import type { Palette } from './themeColor'

export type { Palette }

function isPalette(value: string | null): value is Palette {
  return value !== null && (PALETTES as readonly string[]).includes(value)
}

function applyPalette(palette: Palette) {
  if (palette === 'ocean') {
    document.documentElement.removeAttribute('data-palette')
  } else {
    document.documentElement.setAttribute('data-palette', palette)
  }

  syncThemeColorMeta()
}

let currentPalette: Palette = 'ocean'
const listeners = new Set<() => void>()

function getSnapshot(): Palette {
  return currentPalette
}

function getServerSnapshot(): Palette {
  return 'ocean'
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

function setPaletteStore(nextPalette: Palette) {
  currentPalette = nextPalette
  applyPalette(nextPalette)
  window.localStorage.setItem('palette', nextPalette)
  emitChange()
}

export function usePalette() {
  const palette = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  useEffect(() => {
    const stored = window.localStorage.getItem('palette')
    const initial: Palette = isPalette(stored) ? stored : 'ocean'

    if (initial !== currentPalette) {
      currentPalette = initial
      applyPalette(initial)
      emitChange()
    } else {
      applyPalette(initial)
    }
  }, [])

  const setPalette = useCallback((nextPalette: Palette) => {
    setPaletteStore(nextPalette)
  }, [])

  return { palette, setPalette } as const
}
