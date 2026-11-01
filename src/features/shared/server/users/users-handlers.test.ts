import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRequireSession, mockListUsers } = vi.hoisted(() => ({
  mockRequireSession: vi.fn<() => Promise<string>>(),
  mockListUsers: vi.fn(),
}))
vi.mock('#/features/shared/server/session', () => ({
  requireSession: mockRequireSession,
}))
vi.mock('./user-store', () => ({
  getUserStore: vi.fn(() => Promise.resolve({ listUsers: mockListUsers })),
}))

const { getShareRecipientsHandler } = await import('./users-handlers')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getShareRecipientsHandler', () => {
  it('throws when unauthenticated and never reads the store', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(getShareRecipientsHandler()).rejects.toThrow('Unauthorized')
    expect(mockListUsers).not.toHaveBeenCalled()
  })

  it('excludes the caller and falls back to email for displayName', async () => {
    mockRequireSession.mockResolvedValue('me')
    mockListUsers.mockReturnValue([
      { sub: 'me', email: 'me@x.com', firstName: 'Me', avatarUrl: null },
      {
        sub: 'a',
        email: 'a@x.com',
        firstName: 'Alice',
        avatarUrl: 'http://i/a',
      },
      { sub: 'b', email: 'b@x.com', firstName: null, avatarUrl: null },
    ])
    expect(await getShareRecipientsHandler()).toEqual([
      { sub: 'a', displayName: 'Alice', avatarUrl: 'http://i/a' },
      { sub: 'b', displayName: 'b@x.com', avatarUrl: null },
    ])
  })
})
