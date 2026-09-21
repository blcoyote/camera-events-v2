import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { UserStore } from '#/features/shared/server/users/user-store'
import { createUserStore } from '#/features/shared/server/users/user-store'
import { recordUserLogin } from './record-user-login'

let store: UserStore
let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'record-user-login-test-'))
  store = await createUserStore(path.join(tmpDir, 'test.db'))
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('recordUserLogin', () => {
  it('creates a row on first login, with the right email/first_name/avatar_url', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        avatarUrl: 'https://example.com/ada.png',
      },
      undefined,
    )

    const row = store.getUser('sub-1')
    expect(row).not.toBeNull()
    expect(row?.email).toBe('ada@example.com')
    expect(row?.first_name).toBe('Ada')
    expect(row?.avatar_url).toBe('https://example.com/ada.png')
  })

  it('second login updates profile fields but preserves created_at', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'ada@example.com',
        firstName: 'Ada',
        avatarUrl: 'https://example.com/ada.png',
      },
      undefined,
    )
    const firstRow = store.getUser('sub-1')
    const createdAt = firstRow?.created_at

    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'ada2@example.com',
        firstName: 'Ada Two',
        avatarUrl: 'https://example.com/ada2.png',
      },
      undefined,
    )

    const secondRow = store.getUser('sub-1')
    expect(secondRow?.email).toBe('ada2@example.com')
    expect(secondRow?.first_name).toBe('Ada Two')
    expect(secondRow?.avatar_url).toBe('https://example.com/ada2.png')
    expect(secondRow?.created_at).toBe(createdAt)
  })

  it('promotes to admin when email is in ADMIN_EMAILS', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'admin@x.com',
        firstName: 'Admin',
        avatarUrl: '',
      },
      'admin@x.com',
    )

    expect(store.isAdmin('sub-1')).toBe(true)
  })

  it('does not promote when email is not in ADMIN_EMAILS', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'nobody@x.com',
        firstName: 'Nobody',
        avatarUrl: '',
      },
      'admin@x.com',
    )

    expect(store.isAdmin('sub-1')).toBe(false)
  })

  it('promotes nobody when adminEmailsRaw is undefined (fail-closed)', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'admin@x.com',
        firstName: 'Admin',
        avatarUrl: '',
      },
      undefined,
    )

    expect(store.isAdmin('sub-1')).toBe(false)
  })

  it('promotes nobody when adminEmailsRaw is an empty string', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'admin@x.com',
        firstName: 'Admin',
        avatarUrl: '',
      },
      '',
    )

    expect(store.isAdmin('sub-1')).toBe(false)
  })

  it('never demotes an already-admin user whose email no longer matches', () => {
    store.upsertUser({
      sub: 'sub-1',
      email: 'was-admin@x.com',
      firstName: 'Was Admin',
      avatarUrl: '',
    })
    store.setAdmin('sub-1', true)
    expect(store.isAdmin('sub-1')).toBe(true)

    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'not-in-list@x.com',
        firstName: 'Was Admin',
        avatarUrl: '',
      },
      'admin@x.com',
    )

    expect(store.isAdmin('sub-1')).toBe(true)
  })

  it('promotes case-insensitively', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'Admin@X.com',
        firstName: 'Admin',
        avatarUrl: '',
      },
      'admin@x.com',
    )

    expect(store.isAdmin('sub-1')).toBe(true)
  })

  it('creates no row for an empty-string sub', () => {
    recordUserLogin(
      store,
      { sub: '', email: 'nobody@x.com', firstName: 'Nobody', avatarUrl: '' },
      undefined,
    )

    expect(store.countRows('SELECT * FROM users')).toBe(0)
  })

  it('creates no row for a whitespace-only sub', () => {
    recordUserLogin(
      store,
      {
        sub: '   ',
        email: 'nobody@x.com',
        firstName: 'Nobody',
        avatarUrl: '',
      },
      undefined,
    )

    expect(store.countRows('SELECT * FROM users')).toBe(0)
  })

  it('does not promote a spoofed email that merely contains an allowlisted address', () => {
    recordUserLogin(
      store,
      {
        sub: 'sub-1',
        email: 'evil-admin@x.com',
        firstName: 'Evil',
        avatarUrl: '',
      },
      'admin@x.com',
    )

    expect(store.isAdmin('sub-1')).toBe(false)
  })
})
