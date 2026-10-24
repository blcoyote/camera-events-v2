// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Alert, AlertDescription } from './alert'

afterEach(cleanup)

describe('Alert', () => {
  it('renders role=alert with children', () => {
    render(
      <Alert>
        <AlertDescription>hello</AlertDescription>
      </Alert>,
    )
    expect(screen.getByRole('alert').textContent).toBe('hello')
  })
  it('applies the base classes', () => {
    render(<Alert>x</Alert>)
    const classes = screen.getByRole('alert').className.split(' ')
    expect(classes).toEqual(
      expect.arrayContaining([
        'rounded-card',
        'border',
        'px-4',
        'py-3',
        'text-sm',
        'backdrop-blur-glass',
      ]),
    )
  })
  it.each([
    ['success', 'border-success/40', 'text-success-text'],
    ['destructive', 'border-danger/40', 'text-danger-text'],
  ] as const)('variant %s uses %s and %s', (variant, border, text) => {
    render(<Alert variant={variant}>x</Alert>)
    const classes = screen.getByRole('alert').className.split(' ')
    expect(classes).toContain(border)
    expect(classes).toContain(text)
    expect(classes).toContain('bg-surface-hover')
  })
  it('default variant uses neutral foreground text', () => {
    render(<Alert>x</Alert>)
    const classes = screen.getByRole('alert').className.split(' ')
    expect(classes).toContain('border-border')
    expect(classes).toContain('text-foreground')
  })
  it('merges a custom className and forwards props', () => {
    render(
      <Alert className="mt-2" data-testid="a">
        x
      </Alert>,
    )
    const el = screen.getByTestId('a')
    expect(el.className.split(' ')).toContain('mt-2')
  })
})

describe('AlertDescription', () => {
  it('renders a div with data-slot and merges className', () => {
    render(<AlertDescription className="foo">d</AlertDescription>)
    const el = screen.getByText('d')
    expect(el.getAttribute('data-slot')).toBe('alert-description')
    expect(el.className.split(' ')).toContain('foo')
  })
})
