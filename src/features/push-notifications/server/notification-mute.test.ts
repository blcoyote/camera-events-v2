import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isMuteActive,
  getActiveMuteUntil,
  areNotificationsMuted,
  applyNotificationMute,
} from './notification-mute'
import { getPushStore } from './push-store'
import { MAX_MUTE_DURATION_MS } from '#/features/shared/utils/muteDurations'

vi.mock('./push-store', () => ({
  getPushStore: vi.fn(),
}))

describe('isMuteActive', () => {
  it('returns false when nothing is stored', () => {
    expect(isMuteActive(null, 1_000)).toBe(false)
  })

  it('returns false when the deadline has already passed', () => {
    expect(isMuteActive(500, 1_000)).toBe(false)
  })

  it('returns false when the deadline is exactly now', () => {
    expect(isMuteActive(1_000, 1_000)).toBe(false)
  })

  it('returns true when the deadline is still in the future', () => {
    expect(isMuteActive(1_500, 1_000)).toBe(true)
  })

  it('treats a deadline exactly one full window ahead as active', () => {
    expect(isMuteActive(1_000 + MAX_MUTE_DURATION_MS, 1_000)).toBe(true)
  })

  it('treats a six-hour deadline as active', () => {
    const sixHoursMs = 6 * 60 * 60 * 1000
    expect(isMuteActive(1_000 + sixHoursMs, 1_000)).toBe(true)
  })

  it('rejects a deadline further ahead than one full window (corrupt value cannot mute forever)', () => {
    expect(isMuteActive(1_000 + MAX_MUTE_DURATION_MS + 1, 1_000)).toBe(false)
    expect(isMuteActive(4_102_444_800_000, 1_000)).toBe(false)
  })
})

describe('getActiveMuteUntil', () => {
  const getPushStoreMock = vi.mocked(getPushStore)

  function makeStore(getNotificationMuteUntil: () => number | null) {
    return { getNotificationMuteUntil: vi.fn(getNotificationMuteUntil) }
  }

  beforeEach(() => {
    getPushStoreMock.mockReset()
  })

  it('returns null when no mute is stored', async () => {
    getPushStoreMock.mockResolvedValue(makeStore(() => null) as never)

    expect(await getActiveMuteUntil(1_000)).toBeNull()
  })

  it('returns null when the stored mute has lapsed', async () => {
    getPushStoreMock.mockResolvedValue(makeStore(() => 500) as never)

    expect(await getActiveMuteUntil(1_000)).toBeNull()
  })

  it('returns the deadline when the stored mute is still active', async () => {
    getPushStoreMock.mockResolvedValue(makeStore(() => 1_500) as never)

    expect(await getActiveMuteUntil(1_000)).toBe(1_500)
  })

  it('defaults nowMs to the current time', async () => {
    const future = Date.now() + 60_000
    getPushStoreMock.mockResolvedValue(makeStore(() => future) as never)

    expect(await getActiveMuteUntil()).toBe(future)
  })

  it('fails open (returns null) and logs when the store throws', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    getPushStoreMock.mockRejectedValue(new Error('db unavailable'))

    expect(await getActiveMuteUntil(1_000)).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[notification-mute]'),
      expect.anything(),
    )

    consoleErrorSpy.mockRestore()
  })
})

describe('areNotificationsMuted', () => {
  const getPushStoreMock = vi.mocked(getPushStore)

  beforeEach(() => {
    getPushStoreMock.mockReset()
  })

  it('returns true when a mute is active', async () => {
    getPushStoreMock.mockResolvedValue({
      getNotificationMuteUntil: () => 1_500,
    } as never)

    expect(await areNotificationsMuted(1_000)).toBe(true)
  })

  it('returns false when no mute is active', async () => {
    getPushStoreMock.mockResolvedValue({
      getNotificationMuteUntil: () => null,
    } as never)

    expect(await areNotificationsMuted(1_000)).toBe(false)
  })

  it('fails open (returns false) when the store throws', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    getPushStoreMock.mockRejectedValue(new Error('db unavailable'))

    expect(await areNotificationsMuted(1_000)).toBe(false)

    consoleErrorSpy.mockRestore()
  })
})

describe('applyNotificationMute', () => {
  const getPushStoreMock = vi.mocked(getPushStore)

  beforeEach(() => {
    getPushStoreMock.mockReset()
  })

  it('sets the deadline to now + durationMs and returns it for a non-zero duration', async () => {
    const setNotificationMuteUntil = vi.fn()
    getPushStoreMock.mockResolvedValue({ setNotificationMuteUntil } as never)

    const result = await applyNotificationMute(30 * 60 * 1000, 1_000)

    expect(result).toBe(1_000 + 30 * 60 * 1000)
    expect(setNotificationMuteUntil).toHaveBeenCalledWith(
      1_000 + 30 * 60 * 1000,
    )
  })

  it('clears the mute (writes 0 and returns null) for a zero duration', async () => {
    const setNotificationMuteUntil = vi.fn()
    getPushStoreMock.mockResolvedValue({ setNotificationMuteUntil } as never)

    const result = await applyNotificationMute(0, 1_000)

    expect(result).toBeNull()
    expect(setNotificationMuteUntil).toHaveBeenCalledWith(0)
  })

  it('defaults nowMs to the current time', async () => {
    const setNotificationMuteUntil = vi.fn()
    getPushStoreMock.mockResolvedValue({ setNotificationMuteUntil } as never)
    const before = Date.now()
    const durationMs = 60_000

    const result = await applyNotificationMute(durationMs)

    expect(result).toBeGreaterThanOrEqual(before + durationMs)
    expect(setNotificationMuteUntil).toHaveBeenCalledWith(result)
  })

  it('propagates an error thrown by the store setter (does not fail open)', async () => {
    const setNotificationMuteUntil = vi.fn(() => {
      throw new Error('write failed')
    })
    getPushStoreMock.mockResolvedValue({ setNotificationMuteUntil } as never)

    await expect(applyNotificationMute(60_000, 1_000)).rejects.toThrow(
      'write failed',
    )
  })

  it('propagates an error when getPushStore itself throws', async () => {
    getPushStoreMock.mockRejectedValue(new Error('db unavailable'))

    await expect(applyNotificationMute(60_000, 1_000)).rejects.toThrow(
      'db unavailable',
    )
  })
})
