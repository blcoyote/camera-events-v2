// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { SettingsPage, getSettingsContent } from './SettingsPage'

const mockSetTheme = vi.fn()
const mockSetPalette = vi.fn()
const mockSetEventLimit = vi.fn()

vi.mock('#/features/shared/hooks/useTheme', () => ({
  useTheme: vi.fn(() => ({
    mode: 'light',
    setTheme: mockSetTheme,
    cycleTheme: vi.fn(),
  })),
}))
vi.mock('#/features/shared/hooks/usePalette', () => ({
  usePalette: vi.fn(() => ({
    palette: 'ocean',
    setPalette: mockSetPalette,
  })),
}))
vi.mock('#/features/shared/hooks/useEventLimit', () => ({
  useEventLimit: vi.fn(() => [100, mockSetEventLimit]),
  MIN_EVENT_LIMIT: 25,
  MAX_EVENT_LIMIT: 500,
  EVENT_LIMIT_STEP: 25,
}))
vi.mock('./NotificationSettings', () => ({
  NotificationSettings: () =>
    React.createElement('div', { 'data-testid': 'notification-settings' }),
}))

afterEach(() => {
  cleanup()
  mockSetTheme.mockReset()
  mockSetPalette.mockReset()
  mockSetEventLimit.mockReset()
})

describe('getSettingsContent', () => {
  it('returns the expected heading and description', () => {
    expect(getSettingsContent()).toEqual({
      heading: 'Settings',
      description: 'Account preferences and camera configuration.',
    })
  })
})

describe('SettingsPage', () => {
  it('renders the heading text "Settings"', () => {
    render(<SettingsPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeInTheDocument()
  })

  it('renders Light, Dark, and System theme buttons', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument()
  })

  it('marks the Light button as aria-pressed="true" when mode is light', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('marks the Dark button as aria-pressed="false" when mode is light', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('calls setTheme("dark") when the Dark button is clicked', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('renders Ocean, Sunset, and Slate palette buttons', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'Ocean' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sunset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Slate' })).toBeInTheDocument()
  })

  it('marks the Ocean palette button as aria-pressed="true" when palette is ocean', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'Ocean' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Sunset' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('calls setPalette("sunset") when the Sunset button is clicked', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sunset' }))
    expect(mockSetPalette).toHaveBeenCalledWith('sunset')
  })

  it('renders the event limit slider with the value from the hook', () => {
    render(<SettingsPage />)
    const slider = screen.getByLabelText('Number of events to display')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('value', '100')
  })

  it('calls setEventLimit with the new numeric value when the slider changes', () => {
    render(<SettingsPage />)
    const slider = screen.getByLabelText('Number of events to display')
    fireEvent.change(slider, { target: { value: '200' } })
    expect(mockSetEventLimit).toHaveBeenCalledWith(200)
  })
})
