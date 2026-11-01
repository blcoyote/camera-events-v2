// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'

vi.mock('#/features/live-view/components/LiveSnapshot', () => ({
  LiveSnapshot: () => null,
}))
const { LiveViewPage } = await import('./LiveViewPage')

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('LiveViewPage (da)', () => {
  it('renders the Danish eyebrow', () => {
    render(<LiveViewPage cameraName="front_porch" />)
    expect(screen.getByText('Live-visning')).toBeInTheDocument()
  })
})
