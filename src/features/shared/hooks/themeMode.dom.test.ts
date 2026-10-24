// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { THEME_COLORS, applyResolvedTheme } from './themeMode'

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
