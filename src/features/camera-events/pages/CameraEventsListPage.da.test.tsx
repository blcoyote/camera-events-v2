// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'

vi.mock('#/features/shared/components/EventCard', () => ({
  EventCard: () => null,
}))
const { CameraEventsListPage: Page } = await import('./CameraEventsListPage')

function CameraEventsListPage(
  props: Omit<
    React.ComponentProps<typeof Page>,
    | 'labelFilter'
    | 'cameraFilter'
    | 'onLabelFilterChange'
    | 'onCameraFilterChange'
  >,
) {
  const [labelFilter, setLabel] = useState<string | null>(null)
  const [cameraFilter, setCamera] = useState<string | null>(null)
  return (
    <Page
      {...props}
      labelFilter={labelFilter}
      cameraFilter={cameraFilter}
      onLabelFilterChange={setLabel}
      onCameraFilterChange={setCamera}
    />
  )
}

let restore: () => void
beforeEach(() => {
  restore = withLocale('da')
})
afterEach(() => {
  restore()
  cleanup()
})

describe('CameraEventsListPage (da) event count', () => {
  const ev = (id: string, label = 'person') =>
    ({
      id,
      camera: 'front_porch',
      label,
      start_time: 1713095000,
      end_time: 1713095060,
    }) as never
  const list = (data: never[]) =>
    render(<CameraEventsListPage result={{ ok: true, data }} />)

  it('uses the singular for one event', () => {
    list([ev('a')])
    expect(screen.getByText('1 hændelse')).toBeInTheDocument()
  })

  it('uses the plural for several events', () => {
    list([ev('a'), ev('b')])
    expect(screen.getByText('2 hændelser')).toBeInTheDocument()
  })

  it('uses the filtered wording when a filter is active', () => {
    list([ev('a'), ev('b'), ev('c', 'car')])
    fireEvent.click(screen.getByRole('button', { name: /bil/i }))
    expect(screen.getByText('1 hændelse (filtreret)')).toBeInTheDocument()
  })
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

describe('CameraEventsListPage (da) day headings', () => {
  it('titles today as "I dag"', () => {
    render(
      <CameraEventsListPage
        result={{
          ok: true,
          data: [
            {
              id: 'a',
              camera: 'c',
              label: 'person',
              start_time: Date.now() / 1000,
              end_time: Date.now() / 1000,
            } as never,
          ],
        }}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'I dag' }),
    ).toBeInTheDocument()
  })
})
