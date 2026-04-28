/**
 * Driver-contract characterization test for PushStore.
 *
 * Consolidates every public-API behavior in one file so that, after the
 * SQLite driver swap (Node's better-sqlite3 → shared driver, then bun:sqlite
 * for the Bun runtime), we can re-run this single file unchanged and prove
 * zero behavior drift. If all assertions here are also covered elsewhere,
 * that's intentional — this is the safety net for the driver swap. Do not
 * delete after the refactor lands.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { PushStore } from './push-store'
import { createPushStore } from './push-store'

let store: PushStore
let tmpDir: string
let dbPath: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-store-contract-'))
  dbPath = path.join(tmpDir, 'test.db')
  store = await createPushStore(dbPath)
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('PushStore driver contract: schema', () => {
  it('initializes both required tables', () => {
    const names = store.tableNames()
    expect(names).toContain('push_subscriptions')
    expect(names).toContain('push_notification_preferences')
  })

  it('preferences table has the expected columns', () => {
    const names = store.tableColumns('push_notification_preferences')
    for (const expected of [
      'user_id',
      'category',
      'resource_id',
      'enabled',
      'updated_at',
    ]) {
      expect(names).toContain(expected)
    }
  })
})

describe('PushStore driver contract: subscriptions', () => {
  it('saves a new subscription and reads it back by user', () => {
    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')

    const subs = store.getSubscriptionsByUserId('u1')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({
      user_id: 'u1',
      endpoint: 'https://p.example/1',
      p256dh: 'p1',
      auth: 'a1',
    })
  })

  it('upserts on (user_id, endpoint) collision — keys updated, no duplicate row', () => {
    store.saveSubscription('u1', 'https://p.example/1', 'old-p', 'old-a')
    store.saveSubscription('u1', 'https://p.example/1', 'new-p', 'new-a')

    const subs = store.getSubscriptionsByUserId('u1')
    expect(subs).toHaveLength(1)
    expect(subs[0]).toMatchObject({ p256dh: 'new-p', auth: 'new-a' })
  })

  it('stores multiple subscriptions per user (multi-device)', () => {
    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')
    store.saveSubscription('u1', 'https://p.example/2', 'p2', 'a2')

    expect(store.getSubscriptionsByUserId('u1')).toHaveLength(2)
  })

  it('returns empty array for an unknown user', () => {
    expect(store.getSubscriptionsByUserId('nobody')).toEqual([])
  })

  it('isolates subscriptions between users', () => {
    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')
    store.saveSubscription('u2', 'https://p.example/2', 'p2', 'a2')

    expect(store.getSubscriptionsByUserId('u1')).toHaveLength(1)
    expect(store.getSubscriptionsByUserId('u1')[0].user_id).toBe('u1')
  })

  it('removes a subscription by (user_id, endpoint)', () => {
    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')
    store.saveSubscription('u1', 'https://p.example/2', 'p2', 'a2')

    store.removeSubscription('u1', 'https://p.example/1')

    const subs = store.getSubscriptionsByUserId('u1')
    expect(subs).toHaveLength(1)
    expect(subs[0].endpoint).toBe('https://p.example/2')
  })

  it('removeSubscription is a no-op for an unknown subscription', () => {
    expect(() =>
      store.removeSubscription('u1', 'https://no-such-endpoint'),
    ).not.toThrow()
  })

  it('removes a subscription by endpoint alone (for 410 cleanup)', () => {
    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')
    store.removeSubscriptionByEndpoint('https://p.example/1')
    expect(store.getSubscriptionsByUserId('u1')).toEqual([])
  })

  it('getAllSubscribedUserIds returns distinct ids', () => {
    expect(store.getAllSubscribedUserIds()).toEqual([])

    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')
    store.saveSubscription('u1', 'https://p.example/2', 'p2', 'a2')
    store.saveSubscription('u2', 'https://p.example/3', 'p3', 'a3')

    const ids = store.getAllSubscribedUserIds().sort()
    expect(ids).toEqual(['u1', 'u2'])
  })
})

describe('PushStore driver contract: camera preferences', () => {
  it('defaults a camera with no row to enabled (opt-out model)', () => {
    expect(store.isCameraEnabledForUser('u1', 'front_porch')).toBe(true)
    expect(store.getDisabledCameras('u1')).toEqual([])
  })

  it('disables a camera and reports it as disabled', () => {
    store.setPreference('u1', 'front_porch', false)
    expect(store.isCameraEnabledForUser('u1', 'front_porch')).toBe(false)
    expect(store.getDisabledCameras('u1')).toEqual(['front_porch'])
  })

  it('re-enables a previously disabled camera', () => {
    store.setPreference('u1', 'front_porch', false)
    store.setPreference('u1', 'front_porch', true)
    expect(store.isCameraEnabledForUser('u1', 'front_porch')).toBe(true)
    expect(store.getDisabledCameras('u1')).toEqual([])
  })

  it('upserts the preference row (no duplicates after repeated writes)', () => {
    store.setPreference('u1', 'front_porch', true)
    store.setPreference('u1', 'front_porch', false)
    store.setPreference('u1', 'front_porch', true)

    const count = store.countRows(
      "SELECT id FROM push_notification_preferences WHERE user_id = ? AND category = 'camera' AND resource_id = ?",
      'u1',
      'front_porch',
    )
    expect(count).toBe(1)
  })

  it('isolates preferences between users', () => {
    store.setPreference('u1', 'front_porch', false)
    store.setPreference('u2', 'front_porch', true)

    expect(store.isCameraEnabledForUser('u1', 'front_porch')).toBe(false)
    expect(store.isCameraEnabledForUser('u2', 'front_porch')).toBe(true)
  })
})

describe('PushStore driver contract: persistence', () => {
  it('retains data after close + reopen against the same path', async () => {
    store.saveSubscription('u1', 'https://p.example/1', 'p1', 'a1')
    store.setPreference('u1', 'front_porch', false)
    store.close()

    const reopened = await createPushStore(dbPath)
    try {
      expect(reopened.getSubscriptionsByUserId('u1')).toHaveLength(1)
      expect(reopened.getDisabledCameras('u1')).toEqual(['front_porch'])
    } finally {
      reopened.close()
    }

    // Re-assign so afterEach.close() doesn't double-close the prior handle.
    store = await createPushStore(path.join(tmpDir, 'dummy.db'))
  })
})
