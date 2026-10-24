// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Button } from './button'

afterEach(cleanup)

describe('Button', () => {
  it('defaults to type=button', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })
  it('loading disables, sets aria-busy and renders a spinner', () => {
    render(<Button loading>Go</Button>)
    const btn = screen.getByRole<HTMLButtonElement>('button')
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    const spinner = btn.querySelector('span.animate-spin')
    expect(spinner).not.toBeNull()
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
  })
  it('variant=secondary applies glass', () => {
    render(<Button variant="secondary">Go</Button>)
    expect(screen.getByRole('button').className.split(' ')).toContain('glass')
  })
  it('size=icon keeps its 44px target in flex rows (shrink-0)', () => {
    render(<Button size="icon">x</Button>)
    expect(screen.getByRole('button').className.split(' ')).toContain(
      'shrink-0',
    )
  })
  it('asChild renders the child element', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>,
    )
    const link = screen.getByRole('link')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('type')).toBeNull()
  })
})
