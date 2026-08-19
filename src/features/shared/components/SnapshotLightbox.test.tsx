// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SnapshotLightbox } from './SnapshotLightbox'

afterEach(() => {
  cleanup()
})

describe('SnapshotLightbox rendering', () => {
  it('restores focus to the previously-focused element when the lightbox closes', () => {
    document.body.innerHTML = '<button id="trigger">open</button>'
    const trigger = document.getElementById('trigger') as HTMLButtonElement
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { rerender } = render(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot"
        alt="snap"
        open
        onClose={() => {}}
      />,
    )
    // While open, the close button takes focus
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(document.activeElement).toBe(closeBtn)

    // Close — focus should return to the trigger
    rerender(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot"
        alt="snap"
        open={false}
        onClose={() => {}}
      />,
    )
    expect(document.activeElement).toBe(trigger)
  })

  it('close button has a 44px touch target (h-11 w-11)', () => {
    render(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot"
        alt="snap"
        open
        onClose={() => {}}
      />,
    )
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn.className).toContain('h-11')
    expect(closeBtn.className).toContain('w-11')
  })

  it('close button offsets below the safe-area top inset (avoids iOS status bar overlap)', () => {
    render(
      <SnapshotLightbox
        src="/api/events/abc.1/snapshot"
        alt="snap"
        open
        onClose={() => {}}
      />,
    )
    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn.className).toContain(
      'top-[calc(0.75rem+env(safe-area-inset-top))]',
    )
    expect(closeBtn.className).not.toContain('top-3')
  })
})
