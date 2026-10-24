// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ThemeMode } from '#/features/shared/hooks/themeMode'
import { ThemeToggle } from './ThemeToggle'

const useThemeMock = vi.fn()

vi.mock('#/features/shared/hooks/useTheme', () => ({
  useTheme: () => useThemeMock(),
}))

function mockTheme(mode: ThemeMode) {
  const cycleTheme = vi.fn()
  useThemeMock.mockReturnValue({
    mode,
    resolved: mode === 'dark' ? 'dark' : 'light',
    setTheme: vi.fn(),
    cycleTheme,
  })
  return { cycleTheme }
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe('labels', () => {
    it('labels light mode and offers Dark next', () => {
      mockTheme('light')
      render(<ThemeToggle />)
      const button = screen.getByRole('button', {
        name: 'Theme: Light. Switch to Dark.',
      })
      expect(button.getAttribute('title')).toBe('Theme: Light. Switch to Dark.')
    })

    it('labels dark mode and offers System next', () => {
      mockTheme('dark')
      render(<ThemeToggle />)
      const button = screen.getByRole('button', {
        name: 'Theme: Dark. Switch to System.',
      })
      expect(button.getAttribute('title')).toBe(
        'Theme: Dark. Switch to System.',
      )
    })

    it('labels auto mode as System and offers Light next', () => {
      mockTheme('auto')
      render(<ThemeToggle />)
      const button = screen.getByRole('button', {
        name: 'Theme: System. Switch to Light.',
      })
      expect(button.getAttribute('title')).toBe(
        'Theme: System. Switch to Light.',
      )
    })
  })

  describe('icons', () => {
    it('shows the sun icon in light mode', () => {
      mockTheme('light')
      const { container } = render(<ThemeToggle />)
      expect(container.querySelector('.lucide-sun')).not.toBeNull()
      expect(container.querySelector('.lucide-moon')).toBeNull()
    })

    it('shows the moon icon in dark mode', () => {
      mockTheme('dark')
      const { container } = render(<ThemeToggle />)
      expect(container.querySelector('.lucide-moon')).not.toBeNull()
      expect(container.querySelector('.lucide-sun')).toBeNull()
    })

    it('shows the sun-moon icon in auto mode', () => {
      mockTheme('auto')
      const { container } = render(<ThemeToggle />)
      expect(container.querySelector('.lucide-sun-moon')).not.toBeNull()
    })

    it('hides the icon from assistive tech', () => {
      mockTheme('light')
      const { container } = render(<ThemeToggle />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
    })
  })

  describe('layout', () => {
    it('is a 44px square target', () => {
      mockTheme('light')
      render(<ThemeToggle />)
      const button = screen.getByRole('button')
      expect(button.className).toContain('size-11')
    })
  })

  describe('interaction', () => {
    it('calls cycleTheme when clicked', () => {
      const { cycleTheme } = mockTheme('light')
      render(<ThemeToggle />)
      fireEvent.click(screen.getByRole('button'))
      expect(cycleTheme).toHaveBeenCalledOnce()
    })
  })
})
