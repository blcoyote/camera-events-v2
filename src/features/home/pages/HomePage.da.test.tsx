// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'

vi.mock('#/features/auth/hooks/useStandaloneAuth', () => ({
  useStandaloneAuth: () => ({ onClick: vi.fn() }),
}))
const { HomePage } = await import('./HomePage')

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('HomePage (da)', () => {
  it('renders Danish text', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', {
        name: 'Overvåg dine kameraer, hvor som helst.',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Log ind med Google' }),
    ).toBeInTheDocument()
  })
})
