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
})
