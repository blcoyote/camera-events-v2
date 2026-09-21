import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleGetNotificationMute,
  handleMuteAllNotifications,
} from '#/features/push-notifications/server/admin-mute-handlers'
import { getUserStore } from '#/features/shared/server/users/user-store'
import {
  NOTIFICATION_MUTE_DURATION_MS,
  getActiveMuteUntil,
  muteAllNotifications,
} from '#/features/push-notifications/server/notification-mute'
import type * as NotificationMuteModule from '#/features/push-notifications/server/notification-mute'

vi.mock('#/features/shared/server/users/user-store', () => ({
  getUserStore: vi.fn(),
}))

vi.mock('./notification-mute', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationMuteModule>()),
  getActiveMuteUntil: vi.fn(),
  muteAllNotifications: vi.fn(),
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

describe('handleMuteAllNotifications', () => {
  it('returns 401 when userId is null', async () => {
    const result = await handleMuteAllNotifications(null)
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 403 for a signed-in non-admin and never mutes', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => false),
    } as any)

    const result = await handleMuteAllNotifications('regular-user')

    expect(result.status).toBe(403)
    expect(result.body).toEqual({ error: 'Forbidden' })
    expect(muteAllNotifications).not.toHaveBeenCalled()
  })

  it('mutes for an admin and returns the deadline plus duration', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => true),
    } as any)
    const muteUntil = Date.now() + NOTIFICATION_MUTE_DURATION_MS
    vi.mocked(muteAllNotifications).mockResolvedValue(muteUntil)

    const result = await handleMuteAllNotifications('admin-user')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      mutedUntil: muteUntil,
      durationMs: NOTIFICATION_MUTE_DURATION_MS,
    })
    expect(muteAllNotifications).toHaveBeenCalledOnce()
  })
})
