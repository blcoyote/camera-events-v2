// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { useTheme } from '#/features/shared/hooks/useTheme'
import ThemeToggle from './ThemeToggle'

vi.mock('#/features/shared/hooks/useTheme', () => ({
  useTheme: vi.fn(),
}))

vi.mock('./icons/SunIcon', () => ({
  SunIcon: () => React.createElement('span', null, 'SunIcon'),
}))
vi.mock('./icons/MoonIcon', () => ({
  MoonIcon: () => React.createElement('span', null, 'MoonIcon'),
}))
vi.mock('./icons/AutoIcon', () => ({
  AutoIcon: () => React.createElement('span', null, 'AutoIcon'),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.mocked(useTheme).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders SunIcon and aria-label containing 'light' when mode='light'", () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      cycleTheme: vi.fn(),
      setTheme: vi.fn(),
    })
    render(<ThemeToggle />)
    expect(screen.getByText('SunIcon')).toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(
      /light/i,
    )
  })

  it("renders MoonIcon and aria-label containing 'dark' when mode='dark'", () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'dark',
      cycleTheme: vi.fn(),
      setTheme: vi.fn(),
    })
    render(<ThemeToggle />)
    expect(screen.getByText('MoonIcon')).toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(
      /dark/i,
    )
  })

  it("renders AutoIcon and aria-label containing 'auto' when mode='auto'", () => {
    vi.mocked(useTheme).mockReturnValue({
      mode: 'auto',
      cycleTheme: vi.fn(),
      setTheme: vi.fn(),
    })
    render(<ThemeToggle />)
    expect(screen.getByText('AutoIcon')).toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(
      /auto/i,
    )
  })

  it('clicking the button calls cycleTheme', () => {
    const mockCycle = vi.fn()
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      cycleTheme: mockCycle,
      setTheme: vi.fn(),
    })
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockCycle).toHaveBeenCalledTimes(1)
  })
})
