// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SkeletonCard } from './SkeletonCard'

afterEach(cleanup)

describe('SkeletonCard', () => {
  it('renders four Skeleton primitives (thumbnail plus three text bars)', () => {
    const { container } = render(<SkeletonCard index={0} />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4)
  })

  it('keeps the shimmer class on every placeholder', () => {
    const { container } = render(<SkeletonCard index={0} />)
    const placeholders = container.querySelectorAll('[data-slot="skeleton"]')
    placeholders.forEach((el) => {
      expect(el.classList.contains('skeleton-shimmer')).toBe(true)
      expect(el.getAttribute('aria-hidden')).toBe('true')
    })
  })
})
