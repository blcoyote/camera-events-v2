// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'

vi.mock('#/features/shared/components/EventCard', () => ({
  EventCard: () => null,
}))
const { CameraEventsListPage } = await import('./CameraEventsListPage')

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('CameraEventsListPage (da)', () => {
  it('renders the error and empty states in Danish', () => {
    const { rerender } = render(
      <CameraEventsListPage result={{ ok: false, error: 'x' } as never} />,
    )
    expect(
      screen.getByText('Hændelser kunne ikke indlæses. Tjek at Frigate kører.'),
    ).toBeInTheDocument()
    rerender(<CameraEventsListPage result={{ ok: true, data: [] }} />)
    expect(screen.getByText('Ingen hændelser registreret')).toBeInTheDocument()
  })
})
