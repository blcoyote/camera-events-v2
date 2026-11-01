// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'
import { FavoritesLoading } from './FavoritesLoading'

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('FavoritesLoading (da)', () => {
  it('renders Danish text', () => {
    render(<FavoritesLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Indlæser favoritter')
    expect(screen.getByLabelText('Indlæser favoritter')).toBeInTheDocument()
  })
})
