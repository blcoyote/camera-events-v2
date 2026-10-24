// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Progress } from './progress'

afterEach(cleanup)

describe('Progress', () => {
  it('has role=progressbar with label and value', () => {
    render(<Progress value={42} aria-label="Detection confidence" />)
    const bar = screen.getByRole('progressbar', {
      name: 'Detection confidence',
    })
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })
  it('translates the indicator according to value', () => {
    const { container } = render(<Progress value={25} aria-label="p" />)
    const indicator = container.querySelector(
      '[data-slot="progress-indicator"]',
    )
    expect((indicator as HTMLElement).style.transform).toBe('translateX(-75%)')
  })
  it('merges className onto the root', () => {
    render(<Progress value={1} aria-label="p" className="flex-1" />)
    expect(screen.getByRole('progressbar').className).toContain('flex-1')
  })
})
