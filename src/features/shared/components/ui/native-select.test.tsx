// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NativeSelect } from './native-select'

afterEach(cleanup)

function renderSelect(
  props: Partial<React.ComponentProps<typeof NativeSelect>> = {},
) {
  return render(
    <NativeSelect aria-label="Duration" {...props}>
      <option value="1">One</option>
      <option value="2">Two</option>
    </NativeSelect>,
  )
}

describe('NativeSelect', () => {
  it('renders a native select with its options', () => {
    renderSelect()
    const select = screen.getByLabelText<HTMLSelectElement>('Duration')
    expect(select.tagName).toBe('SELECT')
    expect(select.options).toHaveLength(2)
  })

  it('forwards value and onChange', () => {
    const onChange = vi.fn()
    renderSelect({ value: '1', onChange })
    const select = screen.getByLabelText<HTMLSelectElement>('Duration')
    expect(select.value).toBe('1')
    fireEvent.change(select, { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('removes the OS appearance and draws its own chevron', () => {
    const { container } = renderSelect()
    expect(screen.getByLabelText('Duration').className).toContain(
      'appearance-none',
    )
    const chevron = container.querySelector('[data-slot="native-select-icon"]')
    expect(chevron).not.toBeNull()
    expect(chevron?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shares the Input field styling and merges className', () => {
    renderSelect({ className: 'extra' })
    const cls = screen.getByLabelText('Duration').className
    expect(cls).toContain('rounded-input')
    expect(cls).toContain('bg-control-fill')
    expect(cls).toContain('min-h-11')
    expect(cls).toContain('extra')
  })

  it('forwards aria-invalid and disabled', () => {
    renderSelect({ 'aria-invalid': true, disabled: true })
    const select = screen.getByLabelText<HTMLSelectElement>('Duration')
    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect(select.disabled).toBe(true)
  })
  it('uses control border and fill tokens', () => {
    renderSelect()
    const cls = screen.getByLabelText('Duration').className
    expect(cls).toContain('border-control-border')
    expect(cls).toContain('bg-control-fill')
    expect(cls).not.toMatch(/(^|\s)border-border/)
    expect(cls).not.toContain('bg-surface-warm')
  })
})
