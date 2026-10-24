import { describe, it, expect } from 'vitest'
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  nextThemeMode,
  parseThemeMode,
  resolveThemeMode,
} from './themeMode'

describe('THEME_STORAGE_KEY', () => {
  it('is the localStorage key "theme"', () => {
    expect(THEME_STORAGE_KEY).toBe('theme')
  })
})

describe('THEME_COLORS', () => {
  it('uses the light theme-color from the glassmorphism dark-mode spec', () => {
    expect(THEME_COLORS.light).toBe('#eef6ff')
  })

  it('uses the dark theme-color from the glassmorphism dark-mode spec', () => {
    expect(THEME_COLORS.dark).toBe('#0b1424')
  })

  it('has exactly the light and dark keys', () => {
    expect(Object.keys(THEME_COLORS).sort()).toEqual(['dark', 'light'])
  })
})

describe('parseThemeMode', () => {
  it('accepts "light"', () => {
    expect(parseThemeMode('light')).toBe('light')
  })

  it('accepts "dark"', () => {
    expect(parseThemeMode('dark')).toBe('dark')
  })

  it('accepts "auto"', () => {
    expect(parseThemeMode('auto')).toBe('auto')
  })

  it('falls back to "auto" for null', () => {
    expect(parseThemeMode(null)).toBe('auto')
  })

  it('falls back to "auto" for the empty string', () => {
    expect(parseThemeMode('')).toBe('auto')
  })

  it('falls back to "auto" for uppercase "DARK"', () => {
    expect(parseThemeMode('DARK')).toBe('auto')
  })

  it('falls back to "auto" for uppercase "LIGHT"', () => {
    expect(parseThemeMode('LIGHT')).toBe('auto')
  })

  it('falls back to "auto" for whitespace-padded " dark "', () => {
    expect(parseThemeMode(' dark ')).toBe('auto')
  })

  it('falls back to "auto" for an unknown value such as "system"', () => {
    expect(parseThemeMode('system')).toBe('auto')
  })

  it('falls back to "auto" for a JSON-quoted value such as "\\"dark\\""', () => {
    expect(parseThemeMode('"dark"')).toBe('auto')
  })
})

describe('resolveThemeMode', () => {
  it('returns "light" for mode "light" regardless of prefersDark=false', () => {
    expect(resolveThemeMode('light', false)).toBe('light')
  })

  it('returns "light" for mode "light" regardless of prefersDark=true', () => {
    expect(resolveThemeMode('light', true)).toBe('light')
  })

  it('returns "dark" for mode "dark" regardless of prefersDark=false', () => {
    expect(resolveThemeMode('dark', false)).toBe('dark')
  })

  it('returns "dark" for mode "dark" regardless of prefersDark=true', () => {
    expect(resolveThemeMode('dark', true)).toBe('dark')
  })

  it('returns "light" for mode "auto" when the system prefers light', () => {
    expect(resolveThemeMode('auto', false)).toBe('light')
  })

  it('returns "dark" for mode "auto" when the system prefers dark', () => {
    expect(resolveThemeMode('auto', true)).toBe('dark')
  })
})

describe('nextThemeMode', () => {
  it('cycles light → dark', () => {
    expect(nextThemeMode('light')).toBe('dark')
  })

  it('cycles dark → auto', () => {
    expect(nextThemeMode('dark')).toBe('auto')
  })

  it('cycles auto → light', () => {
    expect(nextThemeMode('auto')).toBe('light')
  })

  it('completes a full cycle back to the start after three steps', () => {
    expect(nextThemeMode(nextThemeMode(nextThemeMode('light')))).toBe('light')
  })
})
