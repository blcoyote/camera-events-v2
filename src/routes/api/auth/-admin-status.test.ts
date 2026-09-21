import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './admin-status'

vi.mock('@tanstack/react-start/server', () => ({
  useSession: vi.fn().mockResolvedValue({ data: { sub: null } }),
}))

vi.mock('#/features/auth/server/admin-status-handlers', () => ({
  handleGetAdminStatus: vi.fn().mockResolvedValue({
    status: 200,
    body: { isAdmin: true },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/auth/admin-status', () => {
  it('marks the response as non-cacheable so a stale role never survives a login switch', async () => {
    const handlers = Route.options.server!.handlers as {
      GET: () => Promise<Response>
    }
    const response = await handlers.GET()

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
