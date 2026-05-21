// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { EventSnapshot } from './EventSnapshot'

afterEach(() => {
  cleanup()
})

describe('EventSnapshot', () => {
  it('uses the plain snapshot URL when showBoundingBox is omitted', () => {
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

  it('uses the plain snapshot URL when showBoundingBox is false', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onZoom={() => {}}
        showBoundingBox={false}
      />,
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/api/events/front_door.123/snapshot')
  })

  it('appends ?bbox=true when showBoundingBox is true', () => {
    render(
      <EventSnapshot
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onZoom={() => {}}
        showBoundingBox={true}
      />,
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute(
      'src',
      '/api/events/front_door.123/snapshot?bbox=true',
    )
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
