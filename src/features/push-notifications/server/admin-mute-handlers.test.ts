import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleGetNotificationMute,
  handleSetNotificationMute,
} from '#/features/push-notifications/server/admin-mute-handlers'
import { getUserStore } from '#/features/shared/server/users/user-store'
import {
  getActiveMuteUntil,
  applyNotificationMute,
} from '#/features/push-notifications/server/notification-mute'
import type * as NotificationMuteModule from '#/features/push-notifications/server/notification-mute'

vi.mock('#/features/shared/server/users/user-store', () => ({
  getUserStore: vi.fn(),
}))

vi.mock('./notification-mute', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationMuteModule>()),
  getActiveMuteUntil: vi.fn(),
  applyNotificationMute: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('handleGetNotificationMute', () => {
  it('returns 401 when userId is null', async () => {
    const result = await handleGetNotificationMute(null)
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when userId is an empty string', async () => {
    const result = await handleGetNotificationMute('')
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: 'Unauthorized' })
  })

  it('returns isAdmin: true and the active mute deadline for an admin during a mute', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => true),
    } as any)
    const muteUntil = Date.now() + 60_000
    vi.mocked(getActiveMuteUntil).mockResolvedValue(muteUntil)

    const result = await handleGetNotificationMute('admin-user')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ isAdmin: true, mutedUntil: muteUntil })
  })

  it('returns isAdmin: true and mutedUntil: null for an admin with no active mute', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => true),
    } as any)
    vi.mocked(getActiveMuteUntil).mockResolvedValue(null)

    const result = await handleGetNotificationMute('admin-user')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ isAdmin: true, mutedUntil: null })
  })

  it('returns 403 for a signed-in non-admin', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => false),
    } as any)

    const result = await handleGetNotificationMute('regular-user')

    expect(result.status).toBe(403)
    expect(result.body).toEqual({ error: 'Forbidden' })
    expect(getActiveMuteUntil).not.toHaveBeenCalled()
  })
})

describe('handleSetNotificationMute', () => {
  it('returns 401 when userId is null', async () => {
    const result = await handleSetNotificationMute(null, { durationMs: 0 })
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 for a signed-in non-admin and never mutes', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => false),
    } as any)

    const result = await handleSetNotificationMute('regular-user', {
      durationMs: 10 * 60 * 1000,
    })

    expect(result.status).toBe(403)
    expect(result.body).toEqual({ error: 'Forbidden' })
    expect(applyNotificationMute).not.toHaveBeenCalled()
  })

  describe('input validation (admin caller)', () => {
    beforeEach(() => {
      vi.mocked(getUserStore).mockResolvedValue({
        isAdmin: vi.fn(() => true),
      } as any)
    })

    it('returns 400 when durationMs is missing', async () => {
      const result = await handleSetNotificationMute('admin-user', {})

      expect(result.status).toBe(400)
      expect(result.body).toEqual({
        error:
          'Invalid request: durationMs must be one of the supported mute durations',
      })
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 400 when durationMs is a string', async () => {
      const result = await handleSetNotificationMute('admin-user', {
        durationMs: '600000',
      })

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 400 for an off-ladder duration', async () => {
      const result = await handleSetNotificationMute('admin-user', {
        durationMs: 7 * 60 * 1000,
      })

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 400 for a duration above the maximum', async () => {
      const result = await handleSetNotificationMute('admin-user', {
        durationMs: 7 * 60 * 60 * 1000,
      })

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })
  })

  it('mutes for an admin for a six-hour duration and returns the deadline', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => true),
    } as any)
    const sixHoursMs = 6 * 60 * 60 * 1000
    const muteUntil = Date.now() + sixHoursMs
    vi.mocked(applyNotificationMute).mockResolvedValue(muteUntil)

    const result = await handleSetNotificationMute('admin-user', {
      durationMs: sixHoursMs,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      mutedUntil: muteUntil,
      durationMs: sixHoursMs,
    })
    expect(applyNotificationMute).toHaveBeenCalledWith(sixHoursMs)
  })

  it('clears the mute for an admin submitting durationMs: 0', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => true),
    } as any)
    vi.mocked(applyNotificationMute).mockResolvedValue(null)

    const result = await handleSetNotificationMute('admin-user', {
      durationMs: 0,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ mutedUntil: null, durationMs: 0 })
    expect(applyNotificationMute).toHaveBeenCalledWith(0)
  })

  describe('malformed top-level body (admin caller)', () => {
    beforeEach(() => {
      vi.mocked(getUserStore).mockResolvedValue({
        isAdmin: vi.fn(() => true),
      } as any)
    })

    it('returns 400 rather than throwing when the body is null', async () => {
      const result = await handleSetNotificationMute('admin-user', null)

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 400 when the body is undefined', async () => {
      const result = await handleSetNotificationMute('admin-user', undefined)

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 400 when the body is a string', async () => {
      const result = await handleSetNotificationMute('admin-user', 'nope')

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 400 when the body is an array', async () => {
      const result = await handleSetNotificationMute('admin-user', [])

      expect(result.status).toBe(400)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })
  })

  describe('malformed body ordering: auth before validation', () => {
    it('returns 401 for a null body when userId is null, never 400', async () => {
      const result = await handleSetNotificationMute(null, null)

      expect(result.status).toBe(401)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 401 for an undefined body when userId is null, never 400', async () => {
      const result = await handleSetNotificationMute(null, undefined)

      expect(result.status).toBe(401)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 403 for a null body from a signed-in non-admin, never 400', async () => {
      vi.mocked(getUserStore).mockResolvedValue({
        isAdmin: vi.fn(() => false),
      } as any)

      const result = await handleSetNotificationMute('regular-user', null)

      expect(result.status).toBe(403)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })

    it('returns 403 for an undefined body from a signed-in non-admin, never 400', async () => {
      vi.mocked(getUserStore).mockResolvedValue({
        isAdmin: vi.fn(() => false),
      } as any)

      const result = await handleSetNotificationMute('regular-user', undefined)

      expect(result.status).toBe(403)
      expect(applyNotificationMute).not.toHaveBeenCalled()
    })
  })
})
