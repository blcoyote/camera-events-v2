import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockLoadEvents = vi.fn()
const mockGetUserFavoritedEventIdsFn = vi.fn()

vi.mock('#/features/shared/server/frigate/client', () => ({
  getEvents: vi.fn(),
  clearCacheFn: vi.fn(),
}))

vi.mock('#/features/shared/server/session', () => ({
  requireSession: vi.fn().mockResolvedValue('user-1'),
}))

vi.mock('#/features/camera-events/server/favorites-fns', () => ({
  getUserFavoritedEventIdsFn: mockGetUserFavoritedEventIdsFn,
}))

// We mock the server function created inline in the route file.
// Instead of testing through TanStack Router machinery, we export
// the loader body as a named function and test that directly.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => {
      mockLoadEvents.mockImplementation(fn as () => unknown)
      return mockLoadEvents
    },
    inputValidator: () => ({
      handler: (fn: unknown) => {
        mockLoadEvents.mockImplementation(fn as () => unknown)
        return mockLoadEvents
      },
    }),
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  useRouter: () => ({ invalidate: vi.fn() }),
}))

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeader: vi.fn().mockReturnValue(''),
}))

vi.mock('#/features/shared/hooks/useEventLimit', () => ({
  readEventLimitFromCookies: vi.fn().mockReturnValue(50),
}))

vi.mock('#/features/shared/hooks/usePullToRefresh', () => ({
  usePullToRefresh: vi.fn().mockReturnValue({
    pullDistance: 0,
    isRefreshing: false,
    isComplete: false,
  }),
}))

vi.mock('#/features/shared/hooks/useRefetchOnFocus', () => ({
  useRefetchOnFocus: vi.fn(),
}))

vi.mock('#/features/shared/hooks/useRefetchOnMount', () => ({
  useRefetchOnMount: vi.fn(),
}))

vi.mock('#/features/shared/components/PullToRefreshIndicator', () => ({
  PullToRefreshIndicator: () => null,
}))

vi.mock('#/features/camera-events/components/CameraEventsListPage', () => ({
  CameraEventsListPage: () => null,
}))

vi.mock('#/features/camera-events/components/CameraEventsLoading', () => ({
  CameraEventsLoading: () => null,
}))

// Import the loader AFTER mocks
const { cameraEventsLoader } = await import('./camera-events.index')

// ─── Tests ────────────────────────────────────────────────────────────────────

const MOCK_EVENTS_RESULT = { ok: true, data: [] } as const

beforeEach(() => {
  vi.clearAllMocks()
  mockLoadEvents.mockResolvedValue(MOCK_EVENTS_RESULT)
  mockGetUserFavoritedEventIdsFn.mockResolvedValue(['evt-1', 'evt-2'])
})

describe('cameraEventsLoader', () => {
  it('returns { result, favoritedEventIds } shape', async () => {
    const data = await cameraEventsLoader()
    expect(data).toHaveProperty('result')
    expect(data).toHaveProperty('favoritedEventIds')
  })

  it('calls both loadEvents and getUserFavoritedEventIdsFn', async () => {
    await cameraEventsLoader()
    expect(mockLoadEvents).toHaveBeenCalled()
    expect(mockGetUserFavoritedEventIdsFn).toHaveBeenCalled()
  })

  it('returns favoritedEventIds from getUserFavoritedEventIdsFn', async () => {
    const data = await cameraEventsLoader()
    expect(data.favoritedEventIds).toEqual(['evt-1', 'evt-2'])
  })

  it('returns favoritedEventIds=[] when getUserFavoritedEventIdsFn fails (graceful degradation)', async () => {
    mockGetUserFavoritedEventIdsFn.mockRejectedValue(new Error('Unauthorized'))
    const data = await cameraEventsLoader()
    expect(data.favoritedEventIds).toEqual([])
  })

  it('still returns events result when favorites call fails', async () => {
    mockGetUserFavoritedEventIdsFn.mockRejectedValue(new Error('Network error'))
    const data = await cameraEventsLoader()
    expect(data.result).toEqual(MOCK_EVENTS_RESULT)
  })
})
