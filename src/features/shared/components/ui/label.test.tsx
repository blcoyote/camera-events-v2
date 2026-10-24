// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Label } from './label'

afterEach(cleanup)

describe('Label', () => {
  it('renders a label element with the given text', () => {
    render(<Label>Mute duration</Label>)
    expect(screen.getByText('Mute duration').tagName).toBe('LABEL')
  })

  it('exposes data-slot="label" and the foreground text classes', () => {
    render(<Label>Refresh interval</Label>)
    const el = screen.getByText('Refresh interval')
    expect(el.getAttribute('data-slot')).toBe('label')
    expect(el.className).toContain('text-sm')
    expect(el.className).toContain('font-medium')
    expect(el.className).toContain('text-foreground')
  })

  it('associates with a control via htmlFor', () => {
    render(
      <>
        <Label htmlFor="duration">Mute duration</Label>
        <select id="duration" />
      </>,
    )
    expect(screen.getByLabelText('Mute duration').id).toBe('duration')
  })

  it('merges a custom className', () => {
    render(<Label className="custom-x">Named</Label>)
    expect(screen.getByText('Named').className).toContain('custom-x')
  })
})
