import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as SessionModule from '#/features/shared/server/session'

const mockGetAppSession = vi.fn()
vi.mock('#/features/shared/server/session', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getAppSession: (...args: unknown[]) => mockGetAppSession(...args),
}))

const mockHandleShareEvent = vi.fn()
vi.mock('#/features/push-notifications/server/share-handlers', () => ({
  handleShareEvent: (...args: unknown[]) => mockHandleShareEvent(...args),
}))

function makeRequest(json: () => Promise<unknown> = vi.fn()): Request {
  return { json: vi.fn(json) } as unknown as Request
}

async function post(request: Request, id = '1700000000.1-abc') {
  const { Route } = await import('./share')
  return (Route.options.server as any).handlers.POST({
    request,
    params: { id },
  }) as Promise<Response>
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/events/$id/share route handler', () => {
  it('returns 401 without reading the body when there is no session', async () => {
    mockGetAppSession.mockResolvedValue({ data: {} })
    mockHandleShareEvent.mockResolvedValue({
      status: 401,
      body: { error: 'unauthorized' },
    })
    const request = makeRequest()

    const res = await post(request)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(request.json).not.toHaveBeenCalled()
    expect(mockHandleShareEvent).toHaveBeenCalledWith(
      null,
      '1700000000.1-abc',
      undefined,
    )
  })

  it('treats a corrupted session as unauthenticated', async () => {
    mockGetAppSession.mockRejectedValue(new Error('bad seal'))
    mockHandleShareEvent.mockResolvedValue({
      status: 401,
      body: { error: 'unauthorized' },
    })
    const request = makeRequest()

    const res = await post(request)

    expect(res.status).toBe(401)
    expect(request.json).not.toHaveBeenCalled()
  })

  it('passes the session sub, event id and parsed body; 204 has no body', async () => {
    mockGetAppSession.mockResolvedValue({ data: { sub: 'user-1' } })
    mockHandleShareEvent.mockResolvedValue({ status: 204 })
    const request = makeRequest(async () => ({ recipientIds: ['user-2'] }))

    const res = await post(request)

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(mockHandleShareEvent).toHaveBeenCalledWith(
      'user-1',
      '1700000000.1-abc',
      { recipientIds: ['user-2'] },
    )
  })

  it('passes malformed JSON through as undefined so the handler returns 400', async () => {
    mockGetAppSession.mockResolvedValue({ data: { sub: 'user-1' } })
    mockHandleShareEvent.mockResolvedValue({
      status: 400,
      body: { error: 'invalid_body' },
    })
    const request = makeRequest(async () => {
      throw new SyntaxError('Unexpected token')
    })

    const res = await post(request)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalid_body' })
    expect(mockHandleShareEvent).toHaveBeenCalledWith(
      'user-1',
      '1700000000.1-abc',
      undefined,
    )
  })

  it('maps an unhandled error to 500 internal_error', async () => {
    mockGetAppSession.mockResolvedValue({ data: { sub: 'user-1' } })
    mockHandleShareEvent.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await post(makeRequest(async () => ({})))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal_error' })
  })
})
