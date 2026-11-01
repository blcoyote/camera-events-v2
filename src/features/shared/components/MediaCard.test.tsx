// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

import { MediaCard } from './MediaCard'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    className,
    style,
    'aria-label': ariaLabel,
  }: {
    to?: string
    children?: React.ReactNode
    className?: string
    style?: React.CSSProperties
    'aria-label'?: string
  }) =>
    React.createElement(
      'a',
      { href: to, className, style, 'aria-label': ariaLabel },
      children,
    ),
}))

afterEach(() => {
  cleanup()
})

describe('MediaCard component', () => {
  it('renders a <div> (not an <a>) when `to` is not provided', () => {
    render(
      <MediaCard image={<div>image</div>} aria-label="card">
        <div>children</div>
      </MediaCard>,
    )
    const root = screen.getByLabelText('card')
    expect(root.tagName).toBe('DIV')
  })

  it('renders an <article> with one empty stretched link when `to` is provided', () => {
    const { container } = render(
      <MediaCard image={<div>image</div>} to="/somewhere" aria-label="card">
        <span data-testid="kid">children</span>
      </MediaCard>,
    )
    expect(container.firstElementChild?.tagName).toBe('ARTICLE')
    const links = screen.getAllByLabelText('card')
    expect(links).toHaveLength(1)
    expect(links[0].tagName).toBe('A')
    expect(links[0]).toHaveAttribute('href', '/somewhere')
    expect(links[0].contains(screen.getByTestId('kid'))).toBe(false)
    expect(container.firstElementChild?.firstElementChild).toBe(links[0])
  })

  it('passes aria-label to the root element', () => {
    render(
      <MediaCard image={<div>image</div>} aria-label="my-card-label">
        <div>children</div>
      </MediaCard>,
    )
    expect(screen.getByLabelText('my-card-label')).toBeInTheDocument()
  })

  it('renders the image slot content', () => {
    render(
      <MediaCard
        image={<span data-testid="image-slot">image-content</span>}
        aria-label="card"
      >
        <div>children</div>
      </MediaCard>,
    )
    expect(screen.getByTestId('image-slot')).toBeInTheDocument()
    expect(screen.getByTestId('image-slot')).toHaveTextContent('image-content')
  })

  it('renders the children slot content', () => {
    render(
      <MediaCard image={<div>image</div>} aria-label="card">
        <span data-testid="children-slot">children-content</span>
      </MediaCard>,
    )
    expect(screen.getByTestId('children-slot')).toBeInTheDocument()
    expect(screen.getByTestId('children-slot')).toHaveTextContent(
      'children-content',
    )
  })

  it('thumbnail wrapper has class `event-thumb` when scanLines is true (default)', () => {
    render(
      <MediaCard image={<div data-testid="img">img</div>} aria-label="card">
        <div>children</div>
      </MediaCard>,
    )
    const thumbWrapper = screen.getByTestId('img').parentElement
    expect(thumbWrapper).not.toBeNull()
    expect(thumbWrapper).toHaveClass('event-thumb')
  })

  it('thumbnail wrapper does NOT have class `event-thumb` when scanLines={false}', () => {
    render(
      <MediaCard
        image={<div data-testid="img">img</div>}
        aria-label="card"
        scanLines={false}
      >
        <div>children</div>
      </MediaCard>,
    )
    const thumbWrapper = screen.getByTestId('img').parentElement
    expect(thumbWrapper).not.toBeNull()
    expect(thumbWrapper).not.toHaveClass('event-thumb')
  })
})
