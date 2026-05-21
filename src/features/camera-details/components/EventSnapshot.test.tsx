// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { EventSnapshot } from './EventSnapshot'

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
})
