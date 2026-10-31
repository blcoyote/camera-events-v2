// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'

vi.mock('#/features/live-view/hooks/useLiveSnapshot', () => ({
  useLiveSnapshot: () => '/x',
}))
vi.mock('#/features/shared/components/SnapshotLightbox', () => ({
  SnapshotLightbox: () => null,
}))
const { LiveSnapshot } = await import('./LiveSnapshot')

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('LiveSnapshot (da)', () => {
  it('renders Danish text', () => {
    render(<LiveSnapshot cameraName="front_porch" />)
    expect(
      screen.getByAltText('Live-stillbillede fra front_porch'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Vis i fuld skærm' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })
})
