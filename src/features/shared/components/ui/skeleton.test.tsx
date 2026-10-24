// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Skeleton } from './skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  it('renders a div with the skeleton-shimmer class', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.classList.contains('skeleton-shimmer')).toBe(true)
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstElementChild as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
  })

  it('merges a custom className with the shimmer class', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />)
    const el = container.firstElementChild as HTMLElement
    expect(el.classList.contains('skeleton-shimmer')).toBe(true)
    expect(el.classList.contains('h-4')).toBe(true)
    expect(el.classList.contains('w-24')).toBe(true)
  })

  it('forwards extra props to the div', () => {
    const { container } = render(<Skeleton data-testid="sk" />)
    expect(container.querySelector('[data-testid="sk"]')).not.toBeNull()
  })
})
