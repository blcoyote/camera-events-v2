// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'
import { CameraEventsLoading } from './CameraEventsLoading'

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('CameraEventsLoading (da)', () => {
  it('renders Danish text', () => {
    render(<CameraEventsLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Indlæser hændelser')
    expect(screen.getByLabelText('Indlæser hændelser')).toBeInTheDocument()
  })
})
