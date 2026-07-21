import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Module mocks (hoisted before imports) ───────────────────────────────────

const mockLoadLiveCameras = vi.fn()
const mockRequireSession = vi.fn()
const mockGetCameras = vi.fn()

vi.mock('#/features/shared/server/session', () => ({
  requireSession: mockRequireSession,
}))

vi.mock('#/features/shared/server/frigate/client', () => ({
  getCameras: mockGetCameras,
}))

// We mock the server function wrapper created inline in the loader file so we
// can call the handler body directly, exactly as
// src/routes/_authenticated/-camera-events.index.test.ts does.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => {
      mockLoadLiveCameras.mockImplementation(fn as () => unknown)
      return mockLoadLiveCameras
    },
  }),
}))

// Import AFTER mocks
const { loadLiveCamerasFn } = await import('./load-cameras')

// ─── Tests ────────────────────────────────────────────────────────────────────

const CAMERAS_RESULT = { ok: true, data: ['garage', 'front_door'] } as const

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireSession.mockResolvedValue('user-google-sub-123')
  mockGetCameras.mockResolvedValue(CAMERAS_RESULT)
})

describe('loadLiveCamerasFn', () => {
  it('calls requireSession before fetching cameras', async () => {
    await loadLiveCamerasFn()
    expect(mockRequireSession).toHaveBeenCalled()
  })

  it('returns the result of getCameras()', async () => {
    const data = await loadLiveCamerasFn()
    expect(data).toEqual(CAMERAS_RESULT)
  })

  it('propagates rejection when requireSession throws (unauthenticated)', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(loadLiveCamerasFn()).rejects.toThrow('Unauthorized')
    expect(mockGetCameras).not.toHaveBeenCalled()
  })
})
