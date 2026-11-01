import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleUpdateLocale } from './locale-handlers'
import { getPushStore } from './push-store'

vi.mock('./push-store', () => ({ getPushStore: vi.fn() }))

const updateLocale = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getPushStore).mockResolvedValue({ updateLocale } as any)
})

describe('handleUpdateLocale', () => {
  it('returns 401 without a user and touches nothing', async () => {
    const r = await handleUpdateLocale(null, {
      endpoint: 'https://e/1',
      locale: 'da',
    })
    expect(r).toEqual({ status: 401, body: { error: 'unauthorized' } })
    expect(updateLocale).not.toHaveBeenCalled()
  })

  it.each([
    ['fr locale', { endpoint: 'https://e/1', locale: 'fr' }],
    ['http endpoint', { endpoint: 'http://e/1', locale: 'da' }],
    ['unparseable endpoint', { endpoint: 'nope', locale: 'da' }],
    ['non-string endpoint', { endpoint: 5, locale: 'da' }],
    ['null body', null],
    ['undefined body', undefined],
  ])('returns 400 for %s', async (_n, body) => {
    const r = await handleUpdateLocale('user1', body)
    expect(r).toEqual({ status: 400, body: { error: 'invalid_body' } })
    expect(updateLocale).not.toHaveBeenCalled()
  })

  it('updates only the session user and returns updated', async () => {
    updateLocale.mockReturnValue(true)
    const r = await handleUpdateLocale('user1', {
      endpoint: 'https://e/1',
      locale: 'da',
    })
    expect(updateLocale).toHaveBeenCalledWith('user1', 'https://e/1', 'da')
    expect(r).toEqual({ status: 200, body: { updated: true } })
  })

  it('returns updated false when no row matched', async () => {
    updateLocale.mockReturnValue(false)
    const r = await handleUpdateLocale('user1', {
      endpoint: 'https://e/1',
      locale: 'en',
    })
    expect(r).toEqual({ status: 200, body: { updated: false } })
  })
})
