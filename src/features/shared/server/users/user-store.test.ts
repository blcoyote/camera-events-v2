import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { UserStore } from './user-store'
import { createUserStore, toIsAdmin } from './user-store'

let store: UserStore
let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-store-test-'))
  store = await createUserStore(path.join(tmpDir, 'test.db'))
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('user-store table initialization', () => {
  it('creates users table on init', () => {
    expect(store.tableNames()).toContain('users')
  })

  it('creates the expected columns', () => {
    expect(store.tableColumns('users')).toEqual([
      'sub',
      'email',
      'first_name',
      'avatar_url',
      'is_admin',
      'created_at',
      'last_login_at',
    ])
  })
})

describe('toIsAdmin', () => {
  it('returns false for null', () => {
    expect(toIsAdmin(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(toIsAdmin(undefined)).toBe(false)
  })

  it('returns false for 0', () => {
    expect(toIsAdmin(0)).toBe(false)
  })

  it("returns false for '0'", () => {
    expect(toIsAdmin('0')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(toIsAdmin('')).toBe(false)
  })

  it('returns false for false', () => {
    expect(toIsAdmin(false)).toBe(false)
  })

  it('returns true for 1', () => {
    expect(toIsAdmin(1)).toBe(true)
  })

  it("returns true for '1'", () => {
    expect(toIsAdmin('1')).toBe(true)
  })

  it('returns true for true', () => {
    expect(toIsAdmin(true)).toBe(true)
  })

  it('returns false for an unexpected object', () => {
    expect(toIsAdmin({})).toBe(false)
  })

  it('returns false for NaN', () => {
    expect(toIsAdmin(NaN)).toBe(false)
  })
})

describe('getUser', () => {
  it('returns null for a sub with no row', () => {
    expect(store.getUser('nonexistent-sub')).toBeNull()
  })

  it('returns the row after upsertUser inserts it', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    const row = store.getUser('sub-1')
    expect(row).not.toBeNull()
    expect(row?.sub).toBe('sub-1')
    expect(row?.email).toBe('a@example.com')
    expect(row?.first_name).toBe('Ada')
    expect(row?.avatar_url).toBe('https://example.com/a.png')
    expect(row?.is_admin).toBe(0)
  })
})

describe('upsertUser', () => {
  it('inserts a new row on first login', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    expect(
      store.countRows('SELECT sub FROM users WHERE sub = ?', 'sub-1'),
    ).toBe(1)
  })

  it('updates profile fields and last_login_at on a return visit', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'old@example.com',
      firstName: 'Old',
      avatarUrl: 'https://example.com/old.png',
    })
    store.upsertUser({
      sub: 'sub-1',
      email: 'new@example.com',
      firstName: 'New',
      avatarUrl: 'https://example.com/new.png',
    })
    const row = store.getUser('sub-1')
    expect(row?.email).toBe('new@example.com')
    expect(row?.first_name).toBe('New')
    expect(row?.avatar_url).toBe('https://example.com/new.png')
  })

  it('never clobbers is_admin or created_at on a repeat login (regression guard)', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.setAdmin('sub-1', true)
    const before = store.getUser('sub-1')

    store.upsertUser({
      sub: 'sub-1',
      email: 'changed@example.com',
      firstName: 'Changed',
      avatarUrl: 'https://example.com/changed.png',
    })

    expect(store.isAdmin('sub-1')).toBe(true)
    const after = store.getUser('sub-1')
    expect(after?.created_at).toBe(before?.created_at)
    expect(after?.email).toBe('changed@example.com')
  })
})

describe('isAdmin', () => {
  it('returns false when no row exists for the sub', () => {
    expect(store.isAdmin('nonexistent-sub')).toBe(false)
  })

  it('returns false for an unknown/empty-string sub', () => {
    expect(store.isAdmin('')).toBe(false)
  })

  it('returns false when the row has is_admin = 0', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    expect(store.isAdmin('sub-1')).toBe(false)
  })

  it('returns true when the row has is_admin = 1', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.setAdmin('sub-1', true)
    expect(store.isAdmin('sub-1')).toBe(true)
  })
})

describe('setAdmin', () => {
  it('promotes a user to admin', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.setAdmin('sub-1', true)
    expect(store.isAdmin('sub-1')).toBe(true)
  })

  it('demotes an admin back to a regular user', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.setAdmin('sub-1', true)
    store.setAdmin('sub-1', false)
    expect(store.isAdmin('sub-1')).toBe(false)
  })
})

describe('promoteToAdmin', () => {
  it('sets is_admin = 1 for an existing user', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.promoteToAdmin('sub-1')
    expect(store.isAdmin('sub-1')).toBe(true)
  })

  it('is idempotent — calling it twice does not throw or change state', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.promoteToAdmin('sub-1')
    store.promoteToAdmin('sub-1')
    expect(store.isAdmin('sub-1')).toBe(true)
  })

  it('does not create a row for a sub that does not exist', () => {
    store.promoteToAdmin('nonexistent-sub')
    expect(store.getUser('nonexistent-sub')).toBeNull()
    expect(
      store.countRows('SELECT sub FROM users WHERE sub = ?', 'nonexistent-sub'),
    ).toBe(0)
  })

  it('does not throw for a sub with no row', () => {
    expect(() => store.promoteToAdmin('nonexistent-sub')).not.toThrow()
  })
})

describe('tableNames', () => {
  it('includes users among the returned table names', () => {
    expect(store.tableNames()).toContain('users')
  })
})

describe('tableColumns', () => {
  it('returns the users table columns in schema order', () => {
    expect(store.tableColumns('users')).toContain('is_admin')
  })
})

describe('countRows', () => {
  it('counts rows matching a SQL query with params', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    store.upsertUser({
      sub: 'sub-2',
      email: 'b@example.com',
      firstName: 'Bea',
      avatarUrl: 'https://example.com/b.png',
    })
    expect(store.countRows('SELECT sub FROM users')).toBe(2)
  })
})

describe('close', () => {
  it('closing then reopening the db retains persisted rows', async () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'a@example.com',
      firstName: 'Ada',
      avatarUrl: 'https://example.com/a.png',
    })
    const dbPath = path.join(tmpDir, 'test.db')
    store.close()

    const store2 = await createUserStore(dbPath)
    expect(store2.getUser('sub-1')?.email).toBe('a@example.com')
    store2.close()

    // Re-assign so afterEach close() does not fail on already-closed db
    store = await createUserStore(path.join(tmpDir, 'dummy.db'))
  })
})
