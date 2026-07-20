import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { resolveIsAuthenticatedFromRequest } from '#/features/shared/server/session'
import { cameraNameFromWsRequest, liveMseWsHooks } from './live-mse-ws'

// The upgrade gate delegates auth to the session helper; mock it so we can
// drive authenticated / unauthenticated outcomes without minting real cookies.
vi.mock('#/features/shared/server/session', () => ({
  resolveIsAuthenticatedFromRequest: vi.fn(),
}))

const authMock = vi.mocked(resolveIsAuthenticatedFromRequest)

const ORIGINAL_FRIGATE_URL = process.env.FRIGATE_URL
beforeEach(() => {
  process.env.FRIGATE_URL = 'http://frigate:5000'
  authMock.mockReset()
})
afterEach(() => {
  if (ORIGINAL_FRIGATE_URL === undefined) delete process.env.FRIGATE_URL
  else process.env.FRIGATE_URL = ORIGINAL_FRIGATE_URL
})

function wsRequest(path: string): Request {
  return new Request(`http://app.example.com${path}`, {
    headers: { upgrade: 'websocket' },
  })
}

describe('cameraNameFromWsRequest', () => {
  it('extracts a valid camera name from the live ws path', () => {
    expect(cameraNameFromWsRequest('http://x/api/live/garage/ws')).toBe(
      'garage',
    )
    expect(cameraNameFromWsRequest('http://x/api/live/gavl_oest/ws')).toBe(
      'gavl_oest',
    )
  })

  it('returns null when the path is not the live ws route', () => {
    expect(
      cameraNameFromWsRequest('http://x/api/live/garage/stream'),
    ).toBeNull()
    expect(cameraNameFromWsRequest('http://x/api/live/garage')).toBeNull()
    expect(cameraNameFromWsRequest('http://x/api/other/garage/ws')).toBeNull()
  })

  it('returns null for a camera name that fails validation (traversal/injection)', () => {
    expect(cameraNameFromWsRequest('http://x/api/live/..%2Fetc/ws')).toBeNull()
    expect(cameraNameFromWsRequest('http://x/api/live/a b/ws')).toBeNull()
    expect(cameraNameFromWsRequest('http://x/api/live/a.b/ws')).toBeNull()
  })

  it('returns null for a malformed URL', () => {
    expect(cameraNameFromWsRequest('not a url')).toBeNull()
  })
})

describe('liveMseWsHooks', () => {
  it('exposes the crossws relay lifecycle hooks from the proxy', () => {
    expect(typeof liveMseWsHooks.open).toBe('function')
    expect(typeof liveMseWsHooks.message).toBe('function')
    expect(typeof liveMseWsHooks.close).toBe('function')
    expect(typeof liveMseWsHooks.upgrade).toBe('function')
  })

  describe('upgrade', () => {
    it('rejects an invalid camera path with 400 without checking auth', async () => {
      let thrown: unknown
      try {
        await liveMseWsHooks.upgrade(wsRequest('/api/live/a b/ws'))
      } catch (err) {
        thrown = err
      }
      expect(thrown).toBeInstanceOf(Response)
      expect((thrown as Response).status).toBe(400)
      expect(authMock).not.toHaveBeenCalled()
    })

    it('rejects an unauthenticated upgrade with 401', async () => {
      authMock.mockResolvedValue(false)
      let thrown: unknown
      try {
        await liveMseWsHooks.upgrade(wsRequest('/api/live/garage/ws'))
      } catch (err) {
        thrown = err
      }
      expect(thrown).toBeInstanceOf(Response)
      expect((thrown as Response).status).toBe(401)
      expect(authMock).toHaveBeenCalledOnce()
    })

    it('allows an authenticated upgrade for a valid camera (does not throw)', async () => {
      authMock.mockResolvedValue(true)
      await expect(
        liveMseWsHooks.upgrade(wsRequest('/api/live/garage/ws')),
      ).resolves.not.toThrow()
      expect(authMock).toHaveBeenCalledOnce()
    })
  })
})
