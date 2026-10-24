// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Slider } from './slider'

afterEach(cleanup)

describe('Slider', () => {
  it('renders a slider role with the given value and bounds', () => {
    render(<Slider aria-label="n" value={[5]} min={1} max={10} step={1} />)
    const thumb = screen.getByRole('slider')
    expect(thumb.getAttribute('aria-valuenow')).toBe('5')
    expect(thumb.getAttribute('aria-valuemin')).toBe('1')
    expect(thumb.getAttribute('aria-valuemax')).toBe('10')
  })

  it('gives the thumb a contrasting semantic border so it is visible on glass at min', () => {
    render(<Slider aria-label="n" value={[1]} min={1} max={10} step={1} />)
    const cls = screen.getByRole('slider').className
    expect(cls).toContain('border-primary')
    expect(cls).not.toContain('border-border')
  })

  it('calls onValueChange with the stepped value on ArrowRight', () => {
    const fn = vi.fn()
    render(
      <Slider
        aria-label="n"
        defaultValue={[4]}
        min={0}
        max={10}
        step={2}
        onValueChange={fn}
      />,
    )
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(fn).toHaveBeenCalledWith([6])
  })

  it('calls onValueChange with a lower value on ArrowLeft', () => {
    const fn = vi.fn()
    render(
      <Slider aria-label="n" defaultValue={[5]} max={10} onValueChange={fn} />,
    )
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' })
    expect(fn).toHaveBeenCalledWith([4])
  })

  it('does not exceed max', () => {
    const fn = vi.fn()
    render(
      <Slider aria-label="n" defaultValue={[10]} max={10} onValueChange={fn} />,
    )
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('10')
  })

  it('names the thumb from aria-labelledby and describes it from aria-describedby', () => {
    render(
      <>
        <span id="l">Volume</span>
        <span id="d">Help text</span>
        <Slider aria-labelledby="l" aria-describedby="d" value={[5]} max={10} />
      </>,
    )
    const thumb = screen.getByRole('slider', { name: 'Volume' })
    expect(thumb.getAttribute('aria-describedby')).toBe('d')
  })
})
