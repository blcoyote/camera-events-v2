// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Card, CardTitle } from './card'

afterEach(cleanup)

describe('Card', () => {
  it('raised is the default', () => {
    render(<Card data-testid="c" />)
    const cls = screen.getByTestId('c').className.split(' ')
    expect(cls).toContain('glass')
    expect(cls).toContain('rounded-card')
  })
  it('flat variant uses glass-flat', () => {
    render(<Card variant="flat" data-testid="c" />)
    const cls = screen.getByTestId('c').className.split(' ')
    expect(cls).toContain('glass-flat')
    expect(cls).toContain('rounded-input')
  })
  it('hero variant uses rounded-hero', () => {
    render(<Card variant="hero" data-testid="c" />)
    const cls = screen.getByTestId('c').className.split(' ')
    expect(cls).toContain('rounded-hero')
    expect(cls).toContain('p-8')
  })
})

describe('CardTitle', () => {
  it('renders its text', () => {
    render(<CardTitle>Hello</CardTitle>)
    expect(screen.getByText('Hello').className).toContain('text-2xl')
  })
  it('renders a level-2 heading without an explicit role attribute', () => {
    render(<CardTitle>Hello</CardTitle>)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.tagName).toBe('H2')
    expect(heading.hasAttribute('role')).toBe(false)
    expect(heading.textContent).toBe('Hello')
  })
})
