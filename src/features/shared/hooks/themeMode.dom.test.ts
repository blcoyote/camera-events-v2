// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  buildThemeInitScript,
  parseThemeMode,
  resolveThemeMode,
} from './themeMode'

describe('applyResolvedTheme', () => {
  beforeEach(() => {
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    document.head.innerHTML = ''
  })

  afterEach(() => {
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    document.head.innerHTML = ''
  })

  describe('class swap', () => {
    it('adds the "dark" class when resolved to dark', () => {
      applyResolvedTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('does not add the "light" class when resolved to dark', () => {
      applyResolvedTheme('dark')
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('adds the "light" class when resolved to light', () => {
      applyResolvedTheme('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('does not add the "dark" class when resolved to light', () => {
      applyResolvedTheme('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('swaps light → dark without leaving both classes', () => {
      applyResolvedTheme('light')
      applyResolvedTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.classList.contains('light')).toBe(false)
    })

    it('swaps dark → light without leaving both classes', () => {
      applyResolvedTheme('dark')
      applyResolvedTheme('light')
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('never leaves both classes on <html> after repeated swaps', () => {
      for (const theme of ['dark', 'light', 'dark', 'dark', 'light'] as const) {
        applyResolvedTheme(theme)
        const classes = document.documentElement.classList
        expect(classes.contains('light') && classes.contains('dark')).toBe(
          false,
        )
      }
    })

    it('preserves unrelated classes on <html>', () => {
      document.documentElement.classList.add('keep-me')
      applyResolvedTheme('dark')
      applyResolvedTheme('light')
      expect(document.documentElement.classList.contains('keep-me')).toBe(true)
    })
  })

  describe('colorScheme', () => {
    it('sets style.colorScheme to "dark" when resolved to dark', () => {
      applyResolvedTheme('dark')
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })

    it('sets style.colorScheme to "light" when resolved to light', () => {
      applyResolvedTheme('dark')
      applyResolvedTheme('light')
      expect(document.documentElement.style.colorScheme).toBe('light')
    })
  })

  describe('theme-color meta', () => {
    it('sets the meta content to the dark theme color when resolved to dark', () => {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = THEME_COLORS.light
      document.head.appendChild(meta)

      applyResolvedTheme('dark')

      expect(meta.content).toBe(THEME_COLORS.dark)
    })

    it('sets the meta content to the light theme color when resolved to light', () => {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = THEME_COLORS.dark
      document.head.appendChild(meta)

      applyResolvedTheme('light')

      expect(meta.content).toBe(THEME_COLORS.light)
    })

    it('updates every theme-color meta, including media-scoped ones', () => {
      const metas = [
        '(prefers-color-scheme: light)',
        '(prefers-color-scheme: dark)',
      ].map((media) => {
        const m = document.createElement('meta')
        m.name = 'theme-color'
        m.media = media
        m.content = 'initial'
        document.head.appendChild(m)
        return m
      })
      applyResolvedTheme('dark')
      expect(metas.map((m) => m.content)).toEqual([
        THEME_COLORS.dark,
        THEME_COLORS.dark,
      ])
    })

    it('does not throw when the theme-color meta is missing', () => {
      expect(() => applyResolvedTheme('dark')).not.toThrow()
      expect(document.querySelector('meta[name="theme-color"]')).toBeNull()
    })

    it('still applies class and colorScheme when the meta is missing', () => {
      applyResolvedTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })
  })

  describe('explicit doc parameter', () => {
    it('operates on the provided document instead of the global one', () => {
      const other = document.implementation.createHTMLDocument('other')
      const meta = other.createElement('meta')
      meta.name = 'theme-color'
      meta.content = THEME_COLORS.light
      other.head.appendChild(meta)

      applyResolvedTheme('dark', other)

      expect(other.documentElement.classList.contains('dark')).toBe(true)
      expect(other.documentElement.style.colorScheme).toBe('dark')
      expect(meta.content).toBe(THEME_COLORS.dark)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})

describe('buildThemeInitScript', () => {
  const originalMatchMedia = window.matchMedia

  function stubMatchMedia(prefersDark: boolean) {
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    })) as unknown as typeof window.matchMedia
  }

  function runScript() {
    new Function(buildThemeInitScript())()
  }

  function addMeta() {
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = 'initial'
    document.head.appendChild(meta)
    return meta
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    document.head.innerHTML = ''
    stubMatchMedia(false)
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    document.head.innerHTML = ''
  })

  it('applies dark class, colorScheme and meta color for stored "dark"', () => {
    const meta = addMeta()
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    runScript()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(meta.content).toBe('#0b1424')
  })

  it('updates every theme-color meta for stored "dark"', () => {
    const a = addMeta()
    const b = addMeta()
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    runScript()
    expect([a.content, b.content]).toEqual(['#0b1424', '#0b1424'])
  })

  it('falls back to light for garbage when the system is not dark', () => {
    const meta = addMeta()
    localStorage.setItem(THEME_STORAGE_KEY, 'garbage')
    runScript()
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(meta.content).toBe('#eef6ff')
  })

  it('resolves "auto" to dark when the system prefers dark', () => {
    stubMatchMedia(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'auto')
    runScript()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not throw when matchMedia throws', () => {
    window.matchMedia = () => {
      throw new Error('boom')
    }
    expect(() => runScript()).not.toThrow()
  })

  describe('when localStorage.getItem throws', () => {
    beforeEach(() => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied')
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('still applies dark when the system prefers dark', () => {
      stubMatchMedia(true)
      const meta = addMeta()
      runScript()
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
      expect(meta.content).toBe('#0b1424')
    })

    it('applies light when the system does not prefer dark', () => {
      stubMatchMedia(false)
      const meta = addMeta()
      runScript()
      expect(document.documentElement.classList.contains('light')).toBe(true)
      expect(meta.content).toBe('#eef6ff')
    })
  })

  it('does not throw when the theme-color meta is missing', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(() => runScript()).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('preserves unrelated classes on <html>', () => {
    document.documentElement.classList.add('keep-me')
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    runScript()
    expect(document.documentElement.classList.contains('keep-me')).toBe(true)
  })

  it('never contains a "</script" sequence', () => {
    expect(buildThemeInitScript().toLowerCase()).not.toContain('</script')
  })

  it('is ES5-safe: no arrow functions, let/const or template literals', () => {
    const script = buildThemeInitScript()
    expect(script).not.toContain('=>')
    expect(script).not.toMatch(/\b(let|const)\b/)
    expect(script).not.toContain('`')
  })

  describe('parity with parseThemeMode + resolveThemeMode', () => {
    const stored = [null, '', 'light', 'dark', 'auto', 'Dark', 'garbage']
    for (const value of stored) {
      for (const prefersDark of [false, true]) {
        it(`stored ${JSON.stringify(value)}, prefersDark ${prefersDark}`, () => {
          stubMatchMedia(prefersDark)
          if (value !== null) localStorage.setItem(THEME_STORAGE_KEY, value)
          const meta = addMeta()
          runScript()

          const expected = resolveThemeMode(parseThemeMode(value), prefersDark)
          const other = expected === 'dark' ? 'light' : 'dark'
          const root = document.documentElement
          expect(root.classList.contains(expected)).toBe(true)
          expect(root.classList.contains(other)).toBe(false)
          expect(root.style.colorScheme).toBe(expected)
          expect(meta.content).toBe(THEME_COLORS[expected])
        })
      }
    }
  })
})
