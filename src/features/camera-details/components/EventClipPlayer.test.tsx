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
    const initialClasses = initialWrapper.className

    fireEvent.error(container.querySelector('video') as HTMLVideoElement)

    const afterWrapper = container.firstElementChild as HTMLElement
    expect(afterWrapper.className).toBe(initialClasses)
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
