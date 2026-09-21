import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleGetAdminStatus } from './admin-status-handlers'
import { getUserStore } from '#/features/shared/server/users/user-store'

vi.mock('#/features/shared/server/users/user-store', () => ({
  getUserStore: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('handleGetAdminStatus', () => {
  it('returns 401 when userId is null', async () => {
    const result = await handleGetAdminStatus(null)
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 when userId is an empty string', async () => {
    const result = await handleGetAdminStatus('')
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: 'Unauthorized' })
  })

  it('returns 200 with isAdmin: true for an admin', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => true),
    } as any)

    const result = await handleGetAdminStatus('admin-user')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ isAdmin: true })
  })

  it('returns 200 with isAdmin: false for a signed-in non-admin', async () => {
    vi.mocked(getUserStore).mockResolvedValue({
      isAdmin: vi.fn(() => false),
    } as any)

    const result = await handleGetAdminStatus('regular-user')

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ isAdmin: false })
  })
})
