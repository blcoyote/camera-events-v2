// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { LiveCameraView } from './LiveCameraView'

afterEach(() => {
  cleanup()
})

describe('LiveCameraView', () => {
  it('renders an img pointed at the stream URL for the camera', () => {
    render(<LiveCameraView camera="garage" />)
    const img = screen.getByAltText('Live view of garage')
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('/api/live/garage/stream'),
    )
  })

  it('shows a Retry button when the stream fails to load', () => {
    render(<LiveCameraView camera="garage" />)
    const img = screen.getByAltText('Live view of garage')
    fireEvent.error(img)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('bumps the img src key when Retry is clicked', () => {
    render(<LiveCameraView camera="garage" />)
    const img = screen.getByAltText('Live view of garage')
    const srcBefore = img.getAttribute('src')
    fireEvent.error(img)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const srcAfter = screen
      .getByAltText('Live view of garage')
      .getAttribute('src')
    expect(srcAfter).not.toBe(srcBefore)
  })
})
