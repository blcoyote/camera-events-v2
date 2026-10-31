// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { SettingsPage, getSettingsContent } from './SettingsPage'

const mockSetEventLimit = vi.fn()
const mockSetLiveViewRefreshSeconds = vi.fn()

vi.mock('#/features/shared/hooks/useEventLimit', () => ({
  useEventLimit: vi.fn(() => [100, mockSetEventLimit]),
  MIN_EVENT_LIMIT: 25,
  MAX_EVENT_LIMIT: 500,
  EVENT_LIMIT_STEP: 25,
}))
vi.mock('#/features/shared/hooks/useLiveViewRefreshInterval', () => ({
  useLiveViewRefreshInterval: vi.fn(() => [2, mockSetLiveViewRefreshSeconds]),
  MIN_LIVE_VIEW_REFRESH_SECONDS: 1,
  MAX_LIVE_VIEW_REFRESH_SECONDS: 10,
  LIVE_VIEW_REFRESH_STEP: 1,
}))
vi.mock('#/features/shared/hooks/useTheme', () => ({
  useTheme: () => ({
    mode: 'auto',
    resolved: 'light',
    setTheme: vi.fn(),
    cycleTheme: vi.fn(),
  }),
}))
vi.mock('./NotificationSettings', () => ({
  NotificationSettings: () =>
    React.createElement('div', { 'data-testid': 'notification-settings' }),
}))

afterEach(() => {
  cleanup()
  mockSetEventLimit.mockReset()
  mockSetLiveViewRefreshSeconds.mockReset()
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

  it('renders the h1 visually hidden on phones', () => {
    render(<SettingsPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toHaveClass('sr-only', 'sm:not-sr-only')
  })

  it('renders the Appearance card second, directly after the hero', () => {
    render(<SettingsPage />)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings[0]).toHaveTextContent('Appearance')
    expect(headings[1]).toHaveTextContent('Camera Events')
  })

  it('renders the Appearance heading and theme group', () => {
    render(<SettingsPage />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Appearance' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
  })

  it('does not render Palette controls', () => {
    render(<SettingsPage />)
    expect(screen.queryByText(/palette/i)).not.toBeInTheDocument()
  })

  it('renders the event limit slider with the value from the hook', () => {
    render(<SettingsPage />)
    const slider = screen.getByRole('slider', {
      name: 'Number of events to display',
    })
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    expect(slider).toHaveAttribute('aria-valuemin', '25')
    expect(slider).toHaveAttribute('aria-valuemax', '500')
    expect(slider).toHaveAccessibleDescription(/Controls how many events/)
  })

  it('calls setEventLimit with the stepped value on ArrowRight', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    screen.getByRole('slider', { name: 'Number of events to display' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(mockSetEventLimit).toHaveBeenCalledWith(125)
  })

  it('renders the live view refresh slider with the value from the hook', () => {
    render(<SettingsPage />)
    const slider = screen.getByRole('slider', { name: 'Refresh interval' })
    expect(slider).toHaveAttribute('aria-valuenow', '2')
    expect(slider).toHaveAccessibleDescription(/live camera snapshot/)
  })

  it('calls setLiveViewRefreshSeconds with the stepped value on ArrowRight', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)
    screen.getByRole('slider', { name: 'Refresh interval' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(mockSetLiveViewRefreshSeconds).toHaveBeenCalledWith(3)
  })

  it('shows the current values in the live value badges', () => {
    render(<SettingsPage />)
    expect(screen.getByText('100 events')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(screen.getByText('2s')).toHaveAttribute('aria-live', 'polite')
  })
})

describe('SettingsPage (da)', () => {
  it('renders Danish copy', async () => {
    const { withLocale } = await import('#/test-utils/locale')
    const restore = withLocale('da')
    try {
      render(<SettingsPage />)
      expect(
        screen.getByRole('heading', { level: 1, name: 'Indstillinger' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Antal hændelser der vises')).toBeInTheDocument()
      expect(screen.getByText('100 hændelser')).toBeInTheDocument()
      expect(screen.getByText('Opdateringsinterval')).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
