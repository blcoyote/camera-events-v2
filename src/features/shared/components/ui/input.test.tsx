// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Input } from './input'

afterEach(cleanup)

describe('Input', () => {
  it('forwards aria-invalid', () => {
    render(<Input aria-invalid="true" aria-label="n" />)
    expect(screen.getByLabelText('n').getAttribute('aria-invalid')).toBe('true')
  })
  it('forwards value and onChange', () => {
    const onChange = vi.fn()
    render(<Input aria-label="n" value="abc" onChange={onChange} />)
    const el = screen.getByLabelText<HTMLInputElement>('n')
    expect(el.value).toBe('abc')
    fireEvent.change(el, { target: { value: 'abcd' } })
    expect(onChange).toHaveBeenCalledOnce()
  })
  it('uses control border and fill tokens', () => {
    render(<Input aria-label="n" />)
    const cls = screen.getByLabelText('n').className
    expect(cls).toContain('border-control-border')
    expect(cls).toContain('bg-control-fill')
    expect(cls).not.toMatch(/(^|\s)border-border/)
    expect(cls).not.toContain('bg-surface-warm')
  })
})
