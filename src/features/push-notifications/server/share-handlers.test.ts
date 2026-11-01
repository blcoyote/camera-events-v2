import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleShareEvent } from './share-handlers'
import type { Delivery, DeliveryRequest } from './delivery'
import { getEventUncached } from '#/features/shared/server/frigate/client'
import { getFavoritesStore } from '#/features/shared/server/favorites/favorites-store'
import { getUserStore } from '#/features/shared/server/users/user-store'
import { retainIfFirst } from '#/features/shared/server/favorites/favorites-handlers'

vi.mock('#/features/shared/server/frigate/client', () => ({
  getEventUncached: vi.fn(),
}))
vi.mock('#/features/shared/server/favorites/favorites-store', () => ({
  getFavoritesStore: vi.fn(),
}))
vi.mock('#/features/shared/server/users/user-store', () => ({
  getUserStore: vi.fn(),
}))
vi.mock('#/features/shared/server/favorites/favorites-handlers', () => ({
  retainIfFirst: vi.fn(),
}))
vi.mock('./delivery', () => ({ createDelivery: vi.fn() }))

const users: Record<
  string,
  { sub: string; email: string; first_name: string }
> = {
  me: { sub: 'me', email: 'me@x.dk', first_name: 'Me' },
  a: { sub: 'a', email: 'a@x.dk', first_name: '' },
  b: { sub: 'b', email: 'b@x.dk', first_name: 'B' },
}
const addShare = vi.fn()
const deliver = vi.fn((_r: DeliveryRequest) => Promise.resolve())
const delivery: Delivery = { deliver }
const run = (body: unknown, userId: string | null = 'me', id = 'ev1.2-abc') =>
  handleShareEvent(userId, id, body, { delivery })

beforeEach(() => {
  vi.resetAllMocks()
  deliver.mockResolvedValue(undefined)
  vi.mocked(getUserStore).mockResolvedValue({
    getUser: (s: string) => users[s] ?? null,
  } as never)
  vi.mocked(getFavoritesStore).mockResolvedValue({ addShare } as never)
  vi.mocked(getEventUncached).mockResolvedValue({
    ok: true,
    data: { label: 'person', camera: 'front_door' },
  } as never)
})

describe('handleShareEvent', () => {
  it('401 without a user', async () => {
    expect(await run({ recipientIds: ['a'] }, null)).toEqual({
      status: 401,
      body: { error: 'unauthorized' },
    })
  })

  it.each([
    ['bad event id', { recipientIds: ['a'] }, 'bad id!/..'],
    ['missing body', undefined, 'ev1'],
    ['non-array', { recipientIds: 'a' }, 'ev1'],
    ['empty', { recipientIds: [] }, 'ev1'],
    ['non-string', { recipientIds: [1] }, 'ev1'],
    [
      'too many',
      { recipientIds: Array.from({ length: 51 }, (_, i) => `u${i}`) },
      'ev1',
    ],
    ['only the caller', { recipientIds: ['me', 'me'] }, 'ev1'],
  ])('400 invalid: %s', async (_n, body, id) => {
    const r = await run(body, 'me', id)
    expect(r.status).toBe(400)
    expect(deliver).not.toHaveBeenCalled()
    expect(addShare).not.toHaveBeenCalled()
  })

  it('400 unknown_recipient', async () => {
    expect(await run({ recipientIds: ['a', 'zzz'] })).toEqual({
      status: 400,
      body: { error: 'unknown_recipient' },
    })
    expect(deliver).not.toHaveBeenCalled()
  })

  it('404 when event missing (uncached lookup)', async () => {
    vi.mocked(getEventUncached).mockResolvedValue({
      ok: false,
      error: 'x',
    } as never)
    expect(await run({ recipientIds: ['a'] })).toEqual({
      status: 404,
      body: { error: 'not_found' },
    })
    expect(addShare).not.toHaveBeenCalled()
  })

  it('shares per recipient, drops caller, dedupes, retains per add', async () => {
    const r = await run({ recipientIds: ['a', 'me', 'b', 'a'] })
    expect(r).toEqual({ status: 204 })
    expect(addShare.mock.calls).toEqual([
      ['ev1.2-abc', 'me', 'a'],
      ['ev1.2-abc', 'me', 'b'],
    ])
    expect(retainIfFirst).toHaveBeenCalledTimes(2)
  })

  it('retains exactly once when a fresh event is shared to two people', async () => {
    let count = 0
    addShare.mockImplementation(() => void count++)
    const store = { addShare, getReferenceCount: () => count }
    vi.mocked(getFavoritesStore).mockResolvedValue(store as never)
    const retained = vi.fn()
    vi.mocked(retainIfFirst).mockImplementation((s, id) => {
      if (s.getReferenceCount(id) === 1) retained(id)
      return Promise.resolve()
    })
    await run({ recipientIds: ['a', 'b'] })
    expect(retained).toHaveBeenCalledTimes(1)
  })

  it('delivers to recipients only, ignoring mute, localized, no event field', async () => {
    await run({ recipientIds: ['a', 'b'] })
    const req = deliver.mock.calls[0][0]
    expect(req.ignoreMute).toBe(true)
    expect(req.burst).toBeUndefined()
    expect(req.allowEndpoint).toBeUndefined()
    const store = {} as never
    expect(req.isUserEligible('a', store)).toBe(true)
    expect(req.isUserEligible('me', store)).toBe(false)
    const en = req.buildPayload(false, 'en')
    expect(en.url).toBe('/camera-events/ev1.2-abc')
    expect(en.tag).toBe('share:ev1.2-abc')
    expect(en.event).toBeUndefined()
    expect(en.title).toContain('Me')
    const da = req.buildPayload(false, 'da')
    expect(da.title).not.toBe(en.title)
    expect(da.locale).toBe('da')
  })

  it('falls back to email, then a generic name', async () => {
    users.me.first_name = ''
    await run({ recipientIds: ['a'] })
    expect(deliver.mock.calls[0][0].buildPayload(false, 'en').title).toContain(
      'me@x.dk',
    )
    users.me.first_name = 'Me'
  })
})
