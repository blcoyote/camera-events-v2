import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUserFavoritedEventsFn = vi.fn()

vi.mock('#/features/shared/server/favorites/favorites-fns', () => ({
  getFavoritesPageFn: mockGetUserFavoritedEventsFn,
  toggleFavoriteFn: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: () => null,
}))

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
  }),
}))

vi.mock('#/features/camera-events/components/FavoritesPage', () => ({
  FavoritesPage: () => null,
}))

vi.mock('#/features/camera-events/components/FavoritesLoading', () => ({
  FavoritesLoading: () => null,
}))

const { favoritesLoader } = await import('./favorites')

const MOCK_ENTRIES = [
  { event: { id: 'evt-1' }, favorited: true, sharedBy: [] },
  { event: { id: 'evt-2' }, favorited: false, sharedBy: ['Alice'] },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUserFavoritedEventsFn.mockResolvedValue(MOCK_ENTRIES)
})

describe('favoritesLoader', () => {
  it('returns the array from getFavoritesPageFn', async () => {
    const result = await favoritesLoader()
    expect(result).toEqual(MOCK_ENTRIES)
  })

  it('returns [] when getFavoritesPageFn throws', async () => {
    mockGetUserFavoritedEventsFn.mockRejectedValue(new Error('Unauthorized'))
    const result = await favoritesLoader()
    expect(result).toEqual([])
  })
})
