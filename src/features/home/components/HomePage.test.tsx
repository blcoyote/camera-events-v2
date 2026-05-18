// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { HomePage } from './HomePage'

const mockOnSignIn = vi.fn()
vi.mock('#/features/auth/hooks/useStandaloneAuth', () => ({
  useStandaloneAuth: vi.fn(() => ({ onClick: mockOnSignIn })),
}))

let replaceStateSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  replaceStateSpy = vi
    .spyOn(window.history, 'replaceState')
    .mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  replaceStateSpy.mockRestore()
  mockOnSignIn.mockReset()
})

describe('HomePage', () => {
  it('renders the "Sign in with Google" link', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('link', { name: 'Sign in with Google' }),
    ).toBeInTheDocument()
  })

  it('uses /api/auth/google as the link href when no returnTo is provided', () => {
    render(<HomePage />)
    const link = screen.getByRole('link', { name: 'Sign in with Google' })
    expect(link).toHaveAttribute('href', '/api/auth/google')
  })

  it('encodes the returnTo param into the link href when provided', () => {
    render(<HomePage returnTo="/camera-events" />)
    const link = screen.getByRole('link', { name: 'Sign in with Google' })
    expect(link).toHaveAttribute(
      'href',
      '/api/auth/google?returnTo=%2Fcamera-events',
    )
  })

  it('renders the error alert text when error="login_failed" is provided', () => {
    render(<HomePage error="login_failed" />)
    expect(
      screen.getByText(
        'Something went wrong during sign-in. Please try again.',
      ),
    ).toBeInTheDocument()
  })

  it('renders the success alert text when status="logged_out" is provided', () => {
    render(<HomePage status="logged_out" />)
    expect(screen.getByText('You have been signed out.')).toBeInTheDocument()
  })
})
