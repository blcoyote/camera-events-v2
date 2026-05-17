import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { PushStore } from './push-store'
import { createPushStore } from './push-store'

let store: PushStore
let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-store-test-'))
  store = await createPushStore(path.join(tmpDir, 'test.db'))
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('push-store table initialization', () => {
  it('creates push_subscriptions table on init', () => {
    expect(store.tableNames()).toContain('push_subscriptions')
  })

  it('creates push_notification_preferences table on init', () => {
    expect(store.tableNames()).toContain('push_notification_preferences')
  })

  it('preferences table has correct columns', () => {
    const names = store.tableColumns('push_notification_preferences')
    expect(names).toContain('user_id')
    expect(names).toContain('category')
    expect(names).toContain('resource_id')
    expect(names).toContain('enabled')
    expect(names).toContain('updated_at')
  })
})

describe('saveSubscription', () => {
  it('inserts a new subscription', () => {
    store.saveSubscription(
      'user1',
      'https://push.example.com/1',
      'p256dh-key',
      'auth-key',
    )

    const subs = store.getSubscriptionsByUserId('user1')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({
      user_id: 'user1',
      endpoint: 'https://push.example.com/1',
      p256dh: 'p256dh-key',
      auth: 'auth-key',
    })
  })

  it('upserts on same (user_id, endpoint) — updates keys', () => {
    store.saveSubscription(
      'user1',
      'https://push.example.com/1',
      'old-p256dh',
      'old-auth',
    )
    store.saveSubscription(
      'user1',
      'https://push.example.com/1',
      'new-p256dh',
      'new-auth',
    )

    const subs = store.getSubscriptionsByUserId('user1')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({
      p256dh: 'new-p256dh',
      auth: 'new-auth',
    })
  })

  it('stores multiple subscriptions for the same user (multi-device)', () => {
    store.saveSubscription('user1', 'https://push.example.com/1', 'k1', 'a1')
    store.saveSubscription('user1', 'https://push.example.com/2', 'k2', 'a2')

    const subs = store.getSubscriptionsByUserId('user1')
    expect(subs).toHaveLength(2)
  })
})

describe('getSubscriptionsByUserId', () => {
  it('returns empty array for unknown user', () => {
    const subs = store.getSubscriptionsByUserId('nobody')
    expect(subs).toEqual([])
  })

  it('returns only subscriptions for the requested user', () => {
    store.saveSubscription('user1', 'https://push.example.com/1', 'k1', 'a1')
    store.saveSubscription('user2', 'https://push.example.com/2', 'k2', 'a2')

    const subs = store.getSubscriptionsByUserId('user1')
    expect(subs).toHaveLength(1)
    expect(subs[0].user_id).toBe('user1')
  })
})

describe('removeSubscription', () => {
  it('removes a subscription by user_id + endpoint', () => {
    store.saveSubscription('user1', 'https://push.example.com/1', 'k1', 'a1')
    store.saveSubscription('user1', 'https://push.example.com/2', 'k2', 'a2')

    store.removeSubscription('user1', 'https://push.example.com/1')

    const subs = store.getSubscriptionsByUserId('user1')
    expect(subs).toHaveLength(1)
    expect(subs[0].endpoint).toBe('https://push.example.com/2')
  })

  it('does nothing when subscription does not exist', () => {
    store.removeSubscription('user1', 'https://nonexistent.example.com')
    // no throw
  })
})

describe('removeSubscriptionByEndpoint', () => {
  it('removes a subscription by endpoint alone (for 410 cleanup)', () => {
    store.saveSubscription('user1', 'https://push.example.com/1', 'k1', 'a1')

    store.removeSubscriptionByEndpoint('https://push.example.com/1')

    const subs = store.getSubscriptionsByUserId('user1')
    expect(subs).toEqual([])
  })
})

describe('getAllSubscribedUserIds', () => {
  it('returns empty array when no subscriptions exist', () => {
    expect(store.getAllSubscribedUserIds()).toEqual([])
  })

  it('returns distinct user IDs', () => {
    store.saveSubscription('user1', 'https://push.example.com/1', 'k1', 'a1')
    store.saveSubscription('user1', 'https://push.example.com/2', 'k2', 'a2')
    store.saveSubscription('user2', 'https://push.example.com/3', 'k3', 'a3')

    const ids = store.getAllSubscribedUserIds()
    expect(ids).toHaveLength(2)
    expect(ids).toContain('user1')
    expect(ids).toContain('user2')
  })
})

describe('camera notification preferences', () => {
  it('defaults to enabled when no preference exists', () => {
    expect(store.isCameraEnabledForUser('user1', 'front_porch')).toBe(true)
  })

  it('returns disabled cameras after setPreference(false)', () => {
    store.setPreference('user1', 'front_porch', false)
    expect(store.isCameraEnabledForUser('user1', 'front_porch')).toBe(false)
    expect(store.getDisabledCameras('user1')).toEqual(['front_porch'])
  })

  it('re-enables a disabled camera', () => {
    store.setPreference('user1', 'front_porch', false)
    store.setPreference('user1', 'front_porch', true)
    expect(store.isCameraEnabledForUser('user1', 'front_porch')).toBe(true)
    expect(store.getDisabledCameras('user1')).toEqual([])
  })

  it('handles multiple cameras per user', () => {
    store.setPreference('user1', 'front_porch', false)
    store.setPreference('user1', 'driveway', false)
    store.setPreference('user1', 'backyard', true)

    const disabled = store.getDisabledCameras('user1')
    expect(disabled).toHaveLength(2)
    expect(disabled).toContain('front_porch')
    expect(disabled).toContain('driveway')
  })

  it('isolates preferences between users', () => {
    store.setPreference('user1', 'front_porch', false)
    store.setPreference('user2', 'front_porch', true)

    expect(store.isCameraEnabledForUser('user1', 'front_porch')).toBe(false)
    expect(store.isCameraEnabledForUser('user2', 'front_porch')).toBe(true)
  })

  it('upserts preferences (does not create duplicate rows)', () => {
    store.setPreference('user1', 'front_porch', true)
    store.setPreference('user1', 'front_porch', false)
    store.setPreference('user1', 'front_porch', true)

    const count = store.countRows(
      "SELECT id FROM push_notification_preferences WHERE user_id = ? AND category = 'camera' AND resource_id = ?",
      'user1',
      'front_porch',
    )
    expect(count).toBe(1)
  })
})

describe('persistence across close/reopen', () => {
  it('retains subscriptions after closing and re-opening the database', async () => {
    store.saveSubscription('user1', 'https://push.example.com/1', 'k1', 'a1')
    const dbPath = path.join(tmpDir, 'test.db')

    store.close()

    const store2 = await createPushStore(dbPath)
    const subs = store2.getSubscriptionsByUserId('user1')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({
      user_id: 'user1',
      endpoint: 'https://push.example.com/1',
    })
    store2.close()

    // Re-assign so afterEach close doesn't fail
    store = await createPushStore(path.join(tmpDir, 'dummy.db'))
  })
})

describe('getPushStore singleton', () => {
  let singletonTmpDir: string

  beforeEach(() => {
    singletonTmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'push-store-singleton-'),
    )
    process.env.PUSH_DB_PATH = path.join(singletonTmpDir, 'singleton.db')
  })

  afterEach(() => {
    delete process.env.PUSH_DB_PATH
    vi.resetModules()
    fs.rmSync(singletonTmpDir, { recursive: true, force: true })
  })

  it('returns a usable store on success', async () => {
    const { getPushStore } = await import('./push-store')
    const s = await getPushStore()
    expect(typeof s.saveSubscription).toBe('function')
    s.close()
  })

  it('retries after a rejected first call instead of caching the rejection', async () => {
    const { openSqlite } = await import('#/features/shared/server/sqlite')
    let callCount = 0
    const originalOpen = openSqlite

    vi.doMock('#/features/shared/server/sqlite', () => ({
      openSqlite: vi.fn(async (...args: Parameters<typeof originalOpen>) => {
        callCount++
        if (callCount === 1) throw new Error('Simulated open failure')
        return originalOpen(...args)
      }),
    }))

    const { getPushStore } = await import('./push-store')

    await expect(getPushStore()).rejects.toThrow('Simulated open failure')
    // Second call must succeed (not re-throw the cached rejection)
    const s = await getPushStore()
    expect(typeof s.saveSubscription).toBe('function')
    s.close()
  })
})
