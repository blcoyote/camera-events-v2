import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updatePushLocaleHandler } from './locale-handlers'
import { requireSession } from '#/features/shared/server/session'
import { getPushStore } from './push-store'

vi.mock('#/features/shared/server/session', () => ({ requireSession: vi.fn() }))
vi.mock('./push-store', () => ({ getPushStore: vi.fn() }))

const updateLocale = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireSession).mockResolvedValue('user1')
  vi.mocked(getPushStore).mockResolvedValue({ updateLocale } as any)
})

describe('updatePushLocaleHandler', () => {
  it('throws Unauthorized without a session and touches nothing', async () => {
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))
    await expect(
      updatePushLocaleHandler({ endpoint: 'https://e/1', locale: 'da' }),
    ).rejects.toThrow('Unauthorized')
    expect(updateLocale).not.toHaveBeenCalled()
  })

  it.each([
    ['fr locale', { endpoint: 'https://e/1', locale: 'fr' }],
    ['http endpoint', { endpoint: 'http://e/1', locale: 'da' }],
    ['unparseable endpoint', { endpoint: 'nope', locale: 'da' }],
    ['non-string endpoint', { endpoint: 5, locale: 'da' }],
  ])('rejects %s', async (_n, input) => {
    await expect(updatePushLocaleHandler(input as any)).rejects.toThrow()
    expect(updateLocale).not.toHaveBeenCalled()
  })

  it('updates only the session user and returns updated', async () => {
    updateLocale.mockReturnValue(true)
    const r = await updatePushLocaleHandler({
      endpoint: 'https://e/1',
      locale: 'da',
    })
    expect(updateLocale).toHaveBeenCalledWith('user1', 'https://e/1', 'da')
    expect(r).toEqual({ updated: true })
  })

  it('returns updated false when no row matched', async () => {
    updateLocale.mockReturnValue(false)
    expect(
      await updatePushLocaleHandler({ endpoint: 'https://e/1', locale: 'en' }),
    ).toEqual({ updated: false })
  })
})
