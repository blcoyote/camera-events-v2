// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AvailabilityAlertsToggle } from './AvailabilityAlertsToggle'
import { withLocale } from '#/test-utils/locale'

describe('AvailabilityAlertsToggle', () => {
  afterEach(cleanup)

  it('labels the switch "Camera offline notifications"', () => {
    render(<AvailabilityAlertsToggle enabled={false} onToggle={vi.fn()} />)
    expect(
      screen.getByRole('switch', { name: 'Camera offline notifications' }),
    ).toBeTruthy()
    expect(screen.getByText('Camera Offline Notifications')).toBeTruthy()
  })

  it('calls onToggle with the inverted value', () => {
    const onToggle = vi.fn()
    render(<AvailabilityAlertsToggle enabled={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('reflects enabled state via aria-checked', () => {
    const { rerender } = render(
      <AvailabilityAlertsToggle enabled={false} onToggle={vi.fn()} />,
    )
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'false',
    )
    rerender(<AvailabilityAlertsToggle enabled onToggle={vi.fn()} />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('calls onToggle(false) when enabled', () => {
    const onToggle = vi.fn()
    render(<AvailabilityAlertsToggle enabled onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('renders Danish copy', () => {
    const restore = withLocale('da')
    try {
      render(<AvailabilityAlertsToggle enabled={false} onToggle={vi.fn()} />)
      expect(
        screen.getByRole('switch', { name: 'Kamerastatus-notifikationer' }),
      ).toBeTruthy()
    } finally {
      restore()
    }
  })
})
