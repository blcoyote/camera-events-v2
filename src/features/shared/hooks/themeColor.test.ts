// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { syncThemeColorMeta, THEME_COLOR_MAP, PALETTES } from './themeColor'
import type { Palette } from './themeColor'

function setMode(mode: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
}

function setPalette(palette: string | null) {
  const root = document.documentElement
  if (palette === null) root.removeAttribute('data-palette')
  else root.setAttribute('data-palette', palette)
}

let meta: HTMLMetaElement

beforeEach(() => {
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-palette')
  meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  document.head.appendChild(meta)
})

afterEach(() => {
  meta.remove()
})

describe('THEME_COLOR_MAP', () => {
  it('has a light and dark entry for every palette in PALETTES', () => {
    for (const palette of PALETTES) {
      expect(THEME_COLOR_MAP[palette]).toBeDefined()
      expect(THEME_COLOR_MAP[palette].light).toMatch(/^#[0-9a-f]{6}$/)
      expect(THEME_COLOR_MAP[palette].dark).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('syncThemeColorMeta', () => {
  const modes = ['light', 'dark'] as const

  for (const palette of ['ocean', 'sunset', 'slate'] as Palette[]) {
    for (const mode of modes) {
      it(`sets the ${palette} ${mode} chrome color from THEME_COLOR_MAP`, () => {
        setMode(mode)
        // ocean is the implicit default (no data-palette attribute)
        setPalette(palette === 'ocean' ? null : palette)

        syncThemeColorMeta()

        expect(meta.getAttribute('content')).toBe(
          THEME_COLOR_MAP[palette][mode],
        )
      })
    }
  }

  it('falls back to ocean when data-palette holds an unknown value', () => {
    setMode('light')
    setPalette('not-a-palette')

    syncThemeColorMeta()

    expect(meta.getAttribute('content')).toBe(THEME_COLOR_MAP.ocean.light)
  })

  it('treats a missing .dark class as light mode', () => {
    document.documentElement.className = ''
    setPalette('slate')

    syncThemeColorMeta()

    expect(meta.getAttribute('content')).toBe(THEME_COLOR_MAP.slate.light)
  })

  it('does not throw when the theme-color meta tag is absent', () => {
    meta.remove()
    setMode('dark')

    expect(() => syncThemeColorMeta()).not.toThrow()
  })
})
