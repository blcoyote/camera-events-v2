// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'
import React from 'react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}))
vi.mock('#/features/shared/components/EventCard', () => ({
  EventCard: () => null,
}))
const { FavoritesPage } = await import('./FavoritesPage')

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('FavoritesPage (da)', () => {
  it('renders the empty state in Danish', () => {
    render(<FavoritesPage entries={[]} />)
    expect(screen.getByText('Ingen favoritter endnu')).toBeInTheDocument()
    expect(screen.getByText('Gå til hændelser')).toBeInTheDocument()
  })

  it('renders the filter group label in Danish', () => {
    render(
      <FavoritesPage
        entries={[
          {
            event: { id: 'e' } as never,
            favorited: true,
            sharedBy: [],
          },
        ]}
      />,
    )
    expect(
      screen.getByRole('group', { name: 'Filtrér favoritter' }),
    ).toBeInTheDocument()
  })
})
