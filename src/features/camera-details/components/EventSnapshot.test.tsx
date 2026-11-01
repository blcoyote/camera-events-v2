// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { EventSnapshot } from './EventSnapshot'
import { withLocale } from '#/test-utils/locale'

afterEach(() => {
  cleanup()
})

describe('EventSnapshot', () => {
  it('uses the snapshot URL for the given event', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onZoom={() => {}}
      />,
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/api/events/front_door.123/snapshot')
  })

  it('invokes onZoom when the snapshot button is clicked', async () => {
    const onZoom = vi.fn()
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onZoom={onZoom}
      />,
    )
    const button = screen.getByRole('button')
    button.click()
    expect(onZoom).toHaveBeenCalledOnce()
  })

  it('labels the button as a fullscreen affordance, not a zoom one', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onZoom={() => {}}
      />,
    )
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toContain(
      'tap to view fullscreen',
    )
    expect(button.getAttribute('aria-label')).not.toContain('zoom')
  })

  it('renders Danish alt text and button label', () => {
    const restore = withLocale('da')
    try {
      render(
        <EventSnapshot
          eventId="front_door.123"
          camera="front_door"
          label="person"
          onZoom={() => {}}
        />,
      )
      expect(screen.getByRole('img')).toHaveAttribute(
        'alt',
        'Stillbillede af Person fra Front Door',
      )
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Stillbillede af Person fra Front Door – tryk for fuldskærm',
      )
    } finally {
      restore()
    }
  })
})
