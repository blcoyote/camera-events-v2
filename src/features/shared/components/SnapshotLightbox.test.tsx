// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SnapshotLightbox } from './SnapshotLightbox'

afterEach(() => {
  cleanup()
})

describe('SnapshotLightbox rendering', () => {
  it('restores focus to the previously-focused element when the lightbox closes', async () => {
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
    await waitFor(() => expect(document.activeElement).toBe(trigger))
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

describe('SnapshotLightbox dialog behaviour', () => {
  const props = { src: '/api/events/abc.1/snapshot', alt: 'Front porch snap' }

  it('renders a dialog named from alt', () => {
    render(<SnapshotLightbox {...props} open onClose={() => {}} />)
    expect(
      screen.getByRole('dialog', { name: 'Front porch snap' }),
    ).toBeInTheDocument()
  })

  it('renders nothing when open is false', () => {
    render(<SnapshotLightbox {...props} open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('Escape calls onClose', () => {
    const onClose = vi.fn()
    render(<SnapshotLightbox {...props} open onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<SnapshotLightbox {...props} open onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('attaches image gesture listeners to the image (portal mount)', () => {
    render(<SnapshotLightbox {...props} open onClose={() => {}} />)
    const img = screen.getByRole('img')
    const ev = new Event('touchmove', { bubbles: true, cancelable: true })
    img.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})
