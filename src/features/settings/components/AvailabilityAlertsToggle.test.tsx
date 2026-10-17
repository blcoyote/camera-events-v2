// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AvailabilityAlertsToggle } from './AvailabilityAlertsToggle'

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
})
