// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import AlertBanner from './AlertBanner'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AlertBanner component', () => {
  it('renders the error alert text for a known error prop', () => {
    render(<AlertBanner error="login_failed" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent(
      'Something went wrong during sign-in. Please try again.',
    )
  })

  it('renders the success alert text for a known status prop', () => {
    render(<AlertBanner status="logged_out" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('You have been signed out.')
  })

  it('renders nothing when given an unknown error code', () => {
    const { container } = render(<AlertBanner error="not_a_real_error" />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it('removes the alert from the document when dismiss button is clicked', () => {
    render(<AlertBanner error="login_failed" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    const dismissButton = screen.getByRole('button', {
      name: 'Dismiss message',
    })
    fireEvent.click(dismissButton)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls window.history.replaceState on mount when an alert is shown', () => {
    const replaceStateSpy = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => {})

    render(<AlertBanner error="login_failed" />)

    expect(replaceStateSpy).toHaveBeenCalled()
  })
})
