// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { FilterPill } from './FilterPill'

afterEach(() => {
  cleanup()
})

describe('FilterPill', () => {
  it('renders the label text', () => {
    render(<FilterPill label="People" active={false} onClick={() => {}} />)
    expect(screen.getByText('People')).toBeInTheDocument()
  })

  it('renders count badge when count prop is provided', () => {
    render(
      <FilterPill label="People" active={false} onClick={() => {}} count={7} />,
    )
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('active count has no opacity-60 and no muted colour (inherits)', () => {
    render(
      <FilterPill label="People" active={true} onClick={() => {}} count={7} />,
    )
    const count = screen.getByText('7')
    expect(count).not.toHaveClass('opacity-60')
    expect(count).not.toHaveClass('text-muted-foreground')
  })

  it('inactive count uses text-muted-foreground and no opacity-60', () => {
    render(
      <FilterPill label="People" active={false} onClick={() => {}} count={7} />,
    )
    const count = screen.getByText('7')
    expect(count).toHaveClass('text-muted-foreground')
    expect(count).not.toHaveClass('opacity-60')
  })

  it('does not render count badge when count is undefined', () => {
    const { container } = render(
      <FilterPill label="People" active={false} onClick={() => {}} />,
    )
    const badge = container.querySelector('span')
    expect(badge).toBeNull()
  })

  it('has aria-pressed="true" when active=true', () => {
    render(<FilterPill label="People" active={true} onClick={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('has aria-pressed="false" when active=false', () => {
    render(<FilterPill label="People" active={false} onClick={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClick when the button is clicked', () => {
    const onClick = vi.fn()
    render(<FilterPill label="People" active={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
