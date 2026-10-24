// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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

  it('does not render Theme or Palette controls', () => {
    render(<SettingsPage />)
    expect(screen.queryByText(/^theme$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/palette/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Dark' }),
    ).not.toBeInTheDocument()
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

  it('renders the live view refresh slider with the value from the hook', () => {
    render(<SettingsPage />)
    const slider = screen.getByLabelText('Refresh interval')
    expect(slider).toBeInTheDocument()
    expect(slider).toHaveAttribute('value', '2')
  })

  it('calls setLiveViewRefreshSeconds with the new numeric value when the slider changes', () => {
    render(<SettingsPage />)
    const slider = screen.getByLabelText('Refresh interval')
    fireEvent.change(slider, { target: { value: '7' } })
    expect(mockSetLiveViewRefreshSeconds).toHaveBeenCalledWith(7)
  })
})
