// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Toggle } from './toggle'

afterEach(cleanup)

describe('Toggle', () => {
  it('reflects pressed state via aria-pressed and data-state', () => {
    render(<Toggle pressed>t</Toggle>)
    const el = screen.getByRole('button')
    expect(el.getAttribute('aria-pressed')).toBe('true')
    expect(el.getAttribute('data-state')).toBe('on')
  })
  it('is off by default', () => {
    render(<Toggle>t</Toggle>)
    expect(screen.getByRole('button').getAttribute('data-state')).toBe('off')
  })
  it('calls onPressedChange', () => {
    const fn = vi.fn()
    render(<Toggle onPressedChange={fn}>t</Toggle>)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledWith(true)
  })
  it('uses the control border and keeps it when pressed', () => {
    render(<Toggle>t</Toggle>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('border-control-border')
    expect(cls).not.toContain('border-transparent')
  })
})
