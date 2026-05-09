import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUserFavoritedEventsFn = vi.fn()

vi.mock('#/features/camera-events/server/favorites-fns', () => ({
  getUserFavoritedEventsFn: mockGetUserFavoritedEventsFn,
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

const MOCK_EVENTS = [
  { id: 'evt-1', label: 'person', camera: 'front_porch' },
  { id: 'evt-2', label: 'car', camera: 'driveway' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUserFavoritedEventsFn.mockResolvedValue(MOCK_EVENTS)
})

describe('favoritesLoader', () => {
  it('returns the array from getUserFavoritedEventsFn', async () => {
    const result = await favoritesLoader()
    expect(result).toEqual(MOCK_EVENTS)
  })

  it('returns [] when getUserFavoritedEventsFn throws', async () => {
    mockGetUserFavoritedEventsFn.mockRejectedValue(new Error('Unauthorized'))
    const result = await favoritesLoader()
    expect(result).toEqual([])
  })
})
