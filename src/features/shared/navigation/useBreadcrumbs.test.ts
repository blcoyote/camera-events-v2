// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBreadcrumbs } from './useBreadcrumbs'

let mockMatches: unknown[] = []

vi.mock('@tanstack/react-router', () => ({
  useMatches: () => mockMatches,
}))

describe('useBreadcrumbs', () => {
  it('returns the trail of the deepest declaring match', () => {
    mockMatches = [
      { staticData: { breadcrumb: () => [{ label: 'shallow' }] } },
      {
        staticData: {
          breadcrumb: ({ params }: { params: { id: string } }) => [
            { label: 'Events', to: '/camera-events' },
            { label: params.id },
          ],
        },
        params: { id: 'abc' },
      },
    ]
    const { result } = renderHook(() => useBreadcrumbs())
    expect(result.current).toEqual([
      { label: 'Events', to: '/camera-events' },
      { label: 'abc' },
    ])
  })

  it('falls back to the app title when no match declares a trail', () => {
    mockMatches = [{}]
    const { result } = renderHook(() => useBreadcrumbs())
    expect(result.current).toEqual([{ label: 'Camera Events' }])
  })
})
