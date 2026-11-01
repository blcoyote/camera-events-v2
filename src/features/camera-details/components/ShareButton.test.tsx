// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { m } from '#/paraglide/messages.js'

vi.mock('./ShareSheet', () => ({
  ShareSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="sheet" /> : null,
}))

const { ShareButton } = await import('./ShareButton')

function setUA(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ShareButton', () => {
  it('renders the Share2 icon on a non-Apple device', () => {
    setUA('Mozilla/5.0 (Linux; Android 14) Chrome/120')
    const { container } = render(<ShareButton eventId="e1" />)
    expect(container.querySelector('svg.lucide-share-2')).toBeInTheDocument()
  })

  it('switches to the Share icon after mount on Apple devices', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    const { container } = render(<ShareButton eventId="e1" />)
    expect(container.querySelector('svg.lucide-share')).toBeInTheDocument()
    expect(container.querySelector('svg.lucide-share-2')).toBeNull()
  })

  it('opens the share sheet on click', () => {
    setUA('x')
    render(<ShareButton eventId="e1" />)
    fireEvent.click(screen.getByRole('button', { name: m.details_share() }))
    expect(screen.getByTestId('sheet')).toBeInTheDocument()
  })
})

describe('ShareButton showLabel', () => {
  it('is icon-only by default', () => {
    render(<ShareButton eventId="e1" />)
    expect(screen.getByRole('button', { name: 'Share' })).toHaveTextContent('')
  })

  it('shows a visible label when showLabel', () => {
    render(<ShareButton eventId="e1" showLabel />)
    expect(screen.getByRole('button', { name: 'Share' })).toHaveTextContent(
      'Share',
    )
  })
})
