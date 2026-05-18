// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

import { EventThumbnail } from './EventThumbnail'

afterEach(() => {
  cleanup()
})

describe('EventThumbnail', () => {
  it('renders an <img> with the correct src initially', () => {
    const { container } = render(<EventThumbnail eventId="test-event-id-123" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute(
      'src',
      '/api/events/test-event-id-123/thumbnail',
    )
  })

  it('renders the <img> with loading="lazy"', () => {
    const { container } = render(<EventThumbnail eventId="test-event-id-123" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('shows fallback after an image error and removes the <img>', () => {
    const { container } = render(<EventThumbnail eventId="test-event-id-123" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()

    fireEvent.error(img!)

    expect(container.querySelector('img')).toBeNull()
    const fallbackSvg = container.querySelector('svg[aria-hidden="true"]')
    expect(fallbackSvg).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
