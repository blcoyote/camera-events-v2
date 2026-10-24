// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { AppearanceSettings } from './AppearanceSettings'

const mockSetTheme = vi.fn()
let mockMode: 'light' | 'dark' | 'auto' = 'auto'

vi.mock('#/features/shared/hooks/useTheme', () => ({
  useTheme: () => ({
    mode: mockMode,
    resolved: mockMode === 'dark' ? 'dark' : 'light',
    setTheme: mockSetTheme,
    cycleTheme: vi.fn(),
  }),
}))

afterEach(() => {
  cleanup()
  mockSetTheme.mockReset()
  mockMode = 'auto'
})

describe('AppearanceSettings', () => {
  it('renders an "Appearance" section heading at level 2', () => {
    render(<AppearanceSettings />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Appearance' }),
    ).toBeInTheDocument()
  })

  it('groups the theme options in a group labelled "Theme"', () => {
    render(<AppearanceSettings />)
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
  })

  it('renders three toggle buttons: Light, Dark and System', () => {
    render(<AppearanceSettings />)
    const buttons = within(
      screen.getByRole('group', { name: 'Theme' }),
    ).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Light',
      'Dark',
      'System',
    ])
  })

  it('marks only the button matching the current mode as pressed', () => {
    mockMode = 'dark'
    render(<AppearanceSettings />)
    expect(
      screen.getByRole('button', { name: 'Dark', pressed: true }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Light', pressed: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'System', pressed: false }),
    ).toBeInTheDocument()
  })

  it('marks System as pressed when the mode is auto', () => {
    mockMode = 'auto'
    render(<AppearanceSettings />)
    expect(
      screen.getByRole('button', { name: 'System', pressed: true }),
    ).toBeInTheDocument()
  })

  it('does not use radio semantics', () => {
    render(<AppearanceSettings />)
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('calls setTheme("dark") when Dark is clicked', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('maps Light to "light" and System to "auto"', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(mockSetTheme).toHaveBeenLastCalledWith('light')
    await user.click(screen.getByRole('button', { name: 'System' }))
    expect(mockSetTheme).toHaveBeenLastCalledWith('auto')
  })
})
