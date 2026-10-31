// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Switch } from './switch'

afterEach(cleanup)

describe('Switch', () => {
  it('has role=switch and flips aria-checked on click', () => {
    render(<Switch aria-label="s" />)
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })
  it('calls onCheckedChange(true)', () => {
    const fn = vi.fn()
    render(<Switch aria-label="s" onCheckedChange={fn} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(fn).toHaveBeenCalledWith(true)
  })
  it('uses control tokens so the boundary shows when off and on', () => {
    render(<Switch aria-label="s" />)
    const sw = screen.getByRole('switch')
    expect(sw.className).toContain('border-control-border')
    expect(sw.className).toContain('bg-control-fill')
    expect(sw.className).not.toContain('border-transparent')
    expect(sw.className).not.toMatch(/(^|\s)border-border/)
    expect(sw.className).not.toContain('bg-surface-warm')
    expect(sw.firstElementChild?.className).toContain('bg-thumb')
    expect(sw.firstElementChild?.className).not.toContain('bg-white')
  })
})
