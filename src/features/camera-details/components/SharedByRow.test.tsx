// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { m } from '#/paraglide/messages.js'
import { SharedByRow } from './SharedByRow'

afterEach(cleanup)

describe('SharedByRow', () => {
  it('renders nothing when empty', () => {
    const { container } = render(
      <SharedByRow sharedBy={[]} onRemove={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a single sender', () => {
    render(<SharedByRow sharedBy={['Alice']} onRemove={vi.fn()} />)
    expect(
      screen.getByText(m.details_shared_by({ names: 'Alice' })),
    ).toBeInTheDocument()
  })

  it('falls back to someone and appends +N', () => {
    render(<SharedByRow sharedBy={[null, 'Bob', 'Cy']} onRemove={vi.fn()} />)
    expect(
      screen.getByText(
        m.details_shared_by({ names: `${m.shared_share_someone()} +2` }),
      ),
    ).toBeInTheDocument()
  })

  it('calls onRemove and disables the button while pending', async () => {
    let resolve!: () => void
    const onRemove = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(<SharedByRow sharedBy={['Alice']} onRemove={onRemove} />)
    const btn = screen.getByRole('button', { name: m.details_share_remove() })
    fireEvent.click(btn)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(btn).toBeDisabled()
    resolve()
    await vi.waitFor(() => expect(btn).not.toBeDisabled())
  })
})
