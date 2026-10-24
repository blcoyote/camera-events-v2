// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Badge } from './badge'

afterEach(cleanup)

describe('Badge', () => {
  it('neutral tone uses text-fg-2', () => {
    render(<Badge>x</Badge>)
    expect(screen.getByText('x').className.split(' ')).toContain('text-fg-2')
  })
  it.each([
    ['accent', 'text-brand-strong'],
    ['success', 'text-success-text'],
    ['warn', 'text-warn-text'],
    ['danger', 'text-danger-text'],
  ] as const)('tone %s maps to %s', (tone, cls) => {
    render(<Badge tone={tone}>x</Badge>)
    expect(screen.getByText('x').className.split(' ')).toContain(cls)
  })
  it('shows an aria-hidden dot by default', () => {
    render(<Badge tone="success">x</Badge>)
    const dot = screen.getByText('x').querySelector('[aria-hidden="true"]')
    expect(dot).not.toBeNull()
    expect(dot?.className).toContain('bg-success')
  })
  it('dot={false} hides the dot', () => {
    render(<Badge dot={false}>x</Badge>)
    expect(
      screen.getByText('x').querySelector('[aria-hidden="true"]'),
    ).toBeNull()
  })
})
