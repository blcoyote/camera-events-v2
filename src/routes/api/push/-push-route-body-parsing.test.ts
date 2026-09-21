import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SessionData } from '#/features/shared/server/session'

/**
 * Route-level coverage for the "don't read the body before auth" guard.
 *
 * The handler-level tests in `-push-endpoints.test.ts` cover the 401 behaviour
 * of `handleSubscribe` et al., but they call the handlers directly with an
 * already-parsed body — they can't observe whether the *route* read the
 * request body before or after resolving the session. These tests exercise
 * the route's `POST`/`PUT` handler directly (via the exported `Route`
 * object's `options.server.handlers`) with a `Request`-like object whose
 * `json()` is a spy, so we can assert it is never called for an
 * unauthenticated caller.
 */

const mockUseSession = vi.fn()

vi.mock('@tanstack/react-start/server', () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
}))

const mockHandleSubscribe = vi.fn()
const mockHandleUnsubscribe = vi.fn()
const mockHandleSetPreference = vi.fn()
const mockHandleGetPreferences = vi.fn()
const mockHandleSetAvailabilityPreference = vi.fn()
const mockHandleGetAvailabilityPreference = vi.fn()

vi.mock('#/features/push-notifications/server/push-handlers', () => ({
  handleSubscribe: (...args: unknown[]) => mockHandleSubscribe(...args),
  handleUnsubscribe: (...args: unknown[]) => mockHandleUnsubscribe(...args),
  handleSetPreference: (...args: unknown[]) => mockHandleSetPreference(...args),
  handleGetPreferences: (...args: unknown[]) =>
    mockHandleGetPreferences(...args),
  handleSetAvailabilityPreference: (...args: unknown[]) =>
    mockHandleSetAvailabilityPreference(...args),
  handleGetAvailabilityPreference: (...args: unknown[]) =>
    mockHandleGetAvailabilityPreference(...args),
}))

const mockHandleSetNotificationMute = vi.fn()
const mockHandleGetNotificationMute = vi.fn()

vi.mock('#/features/push-notifications/server/admin-mute-handlers', () => ({
  handleSetNotificationMute: (...args: unknown[]) =>
    mockHandleSetNotificationMute(...args),
  handleGetNotificationMute: (...args: unknown[]) =>
    mockHandleGetNotificationMute(...args),
}))

function makeRequest(): Request {
  return { json: vi.fn() } as unknown as Request
}

function sessionWithSub(sub: string | undefined): {
  data: Partial<SessionData>
} {
  return { data: sub === undefined ? {} : { sub } }
}

// The routes call the real `getSessionConfig()` (only `useSession` itself is
// mocked), which throws without a sufficiently long `SESSION_SECRET`. Give it
// one so the route's own try/catch doesn't swallow every session as
// "corrupted" regardless of what the mocked `useSession` resolves to.
const originalSessionSecret = process.env.SESSION_SECRET

beforeEach(() => {
  vi.resetAllMocks()
  process.env.SESSION_SECRET = 'a'.repeat(32)
})

afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET
  else process.env.SESSION_SECRET = originalSessionSecret
})

describe('POST /api/push/subscribe route handler', () => {
  it('does not read the request body when there is no session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub(undefined))
    mockHandleSubscribe.mockResolvedValue({ status: 401, body: {} })
    const { Route } = await import('./subscribe')
    const request = makeRequest()

    await (Route.options.server as any).handlers.POST({ request })

    expect(request.json).not.toHaveBeenCalled()
    expect(mockHandleSubscribe).toHaveBeenCalledWith(null, undefined)
  })

  it('reads the request body when there is a session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub('user-1'))
    mockHandleSubscribe.mockResolvedValue({ status: 200, body: {} })
    const { Route } = await import('./subscribe')
    const request = makeRequest()
    vi.mocked(request.json).mockResolvedValue({ endpoint: 'x' })

    await (Route.options.server as any).handlers.POST({ request })

    expect(request.json).toHaveBeenCalledOnce()
    expect(mockHandleSubscribe).toHaveBeenCalledWith('user-1', {
      endpoint: 'x',
    })
  })
})

describe('POST /api/push/unsubscribe route handler', () => {
  it('does not read the request body when there is no session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub(undefined))
    mockHandleUnsubscribe.mockResolvedValue({ status: 401, body: {} })
    const { Route } = await import('./unsubscribe')
    const request = makeRequest()

    await (Route.options.server as any).handlers.POST({ request })

    expect(request.json).not.toHaveBeenCalled()
    expect(mockHandleUnsubscribe).toHaveBeenCalledWith(null, undefined)
  })

  it('reads the request body when there is a session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub('user-1'))
    mockHandleUnsubscribe.mockResolvedValue({ status: 200, body: {} })
    const { Route } = await import('./unsubscribe')
    const request = makeRequest()
    vi.mocked(request.json).mockResolvedValue({ endpoint: 'x' })

    await (Route.options.server as any).handlers.POST({ request })

    expect(request.json).toHaveBeenCalledOnce()
    expect(mockHandleUnsubscribe).toHaveBeenCalledWith('user-1', {
      endpoint: 'x',
    })
  })
})

describe('PUT /api/push/preferences route handler', () => {
  it('does not read the request body when there is no session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub(undefined))
    mockHandleSetPreference.mockResolvedValue({ status: 401, body: {} })
    const { Route } = await import('./preferences')
    const request = makeRequest()

    await (Route.options.server as any).handlers.PUT({ request })

    expect(request.json).not.toHaveBeenCalled()
    expect(mockHandleSetPreference).toHaveBeenCalledWith(null, undefined)
  })

  it('reads the request body when there is a session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub('user-1'))
    mockHandleSetPreference.mockResolvedValue({ status: 200, body: {} })
    const { Route } = await import('./preferences')
    const request = makeRequest()
    vi.mocked(request.json).mockResolvedValue({ camera: 'front', mute: true })

    await (Route.options.server as any).handlers.PUT({ request })

    expect(request.json).toHaveBeenCalledOnce()
    expect(mockHandleSetPreference).toHaveBeenCalledWith('user-1', {
      camera: 'front',
      mute: true,
    })
  })
})

describe('PUT /api/push/availability-preference route handler', () => {
  it('does not read the request body when there is no session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub(undefined))
    mockHandleSetAvailabilityPreference.mockResolvedValue({
      status: 401,
      body: {},
    })
    const { Route } = await import('./availability-preference')
    const request = makeRequest()

    await (Route.options.server as any).handlers.PUT({ request })

    expect(request.json).not.toHaveBeenCalled()
    expect(mockHandleSetAvailabilityPreference).toHaveBeenCalledWith(
      null,
      undefined,
    )
  })

  it('reads the request body when there is a session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub('user-1'))
    mockHandleSetAvailabilityPreference.mockResolvedValue({
      status: 200,
      body: {},
    })
    const { Route } = await import('./availability-preference')
    const request = makeRequest()
    vi.mocked(request.json).mockResolvedValue({ enabled: true })

    await (Route.options.server as any).handlers.PUT({ request })

    expect(request.json).toHaveBeenCalledOnce()
    expect(mockHandleSetAvailabilityPreference).toHaveBeenCalledWith('user-1', {
      enabled: true,
    })
  })
})

describe('POST /api/push/mute route handler', () => {
  it('does not read the request body when there is no session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub(undefined))
    mockHandleSetNotificationMute.mockResolvedValue({ status: 401, body: {} })
    const { Route } = await import('./mute')
    const request = makeRequest()

    await (Route.options.server as any).handlers.POST({ request })

    expect(request.json).not.toHaveBeenCalled()
    expect(mockHandleSetNotificationMute).toHaveBeenCalledWith(null, undefined)
  })

  it('reads the request body when there is a session sub', async () => {
    mockUseSession.mockResolvedValue(sessionWithSub('admin-1'))
    mockHandleSetNotificationMute.mockResolvedValue({ status: 200, body: {} })
    const { Route } = await import('./mute')
    const request = makeRequest()
    vi.mocked(request.json).mockResolvedValue({ muted: true })

    await (Route.options.server as any).handlers.POST({ request })

    expect(request.json).toHaveBeenCalledOnce()
    expect(mockHandleSetNotificationMute).toHaveBeenCalledWith('admin-1', {
      muted: true,
    })
  })
})
