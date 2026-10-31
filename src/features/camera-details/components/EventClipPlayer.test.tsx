// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { EventClipPlayer } from './EventClipPlayer'

afterEach(() => {
  cleanup()
})

describe('EventClipPlayer', () => {
  it('renders a <video> element pointing at the proxied clip endpoint', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()
    expect(video.getAttribute('src')).toBe('/api/events/front_door.123/clip')
  })

  it('sets controls, playsInline, and preload="metadata"; does NOT set autoplay', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video.hasAttribute('controls')).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.getAttribute('preload')).toBe('metadata')
    expect(video.hasAttribute('autoplay')).toBe(false)
  })

  it('renders inside an aspect-ratio container', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toMatch(/aspect-/)
  })

  it('has a descriptive aria-label referencing camera and label', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const video = container.querySelector('video') as HTMLVideoElement
    const aria = video.getAttribute('aria-label') ?? ''
    expect(aria.toLowerCase()).toContain('person')
    expect(aria.toLowerCase()).toContain('front door')
  })

  it('swaps to a "Couldn\'t load clip" fallback when the video onError fires', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()

    fireEvent.error(video)

    // After error: no video element, fallback message visible
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByText(/couldn't load clip/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Frigate may still be saving it, or it may no longer be stored.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
  })

  it('drops the black wrapper background once errored', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).toHaveClass('bg-black')
    fireEvent.error(container.querySelector('video') as HTMLVideoElement)
    expect(wrapper).not.toHaveClass('bg-black')
  })

  it('Try again remounts a <video> with a retry query param and onError fires each time', () => {
    const onError = vi.fn()
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onError={onError}
      />,
    )
    fireEvent.error(container.querySelector('video') as HTMLVideoElement)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    const video = container.querySelector('video') as HTMLVideoElement
    expect(video).toBeInTheDocument()
    expect(video.getAttribute('src')).toContain('retry=1')

    fireEvent.error(video)
    expect(onError).toHaveBeenCalledTimes(2)
  })

  it('keeps the same aspect-ratio wrapper after onError so layout does not shift', () => {
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
      />,
    )
    const initialWrapper = container.firstElementChild as HTMLElement

    fireEvent.error(container.querySelector('video') as HTMLVideoElement)

    const afterWrapper = container.firstElementChild as HTMLElement
    for (const c of ['aspect-video', 'w-full', 'relative', 'overflow-hidden']) {
      expect(initialWrapper).toHaveClass(c)
      expect(afterWrapper).toHaveClass(c)
    }
  })

  it('invokes the optional onError callback when the video errors', () => {
    const onError = vi.fn()
    const { container } = render(
      <EventClipPlayer
        eventId="front_door.123"
        camera="front_door"
        label="person"
        onError={onError}
      />,
    )
    fireEvent.error(container.querySelector('video') as HTMLVideoElement)
    expect(onError).toHaveBeenCalledOnce()
  })
})
