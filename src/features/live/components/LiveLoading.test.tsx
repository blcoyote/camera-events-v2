// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveLoading } from './LiveLoading'

afterEach(() => {
  cleanup()
})

describe('LiveLoading', () => {
  it('renders a loading status region', () => {
    render(<LiveLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading cameras')
  })

  it('marks the main region as busy', () => {
    render(<LiveLoading />)
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
  })
})
