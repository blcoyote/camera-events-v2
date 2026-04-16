import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_DB_PATH = 'data/camera-events.db'

export interface PushSubscriptionRow {
  id: number
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export interface PushStore {
  db: Database.Database
  saveSubscription: (
    userId: string,
    endpoint: string,
    p256dh: string,
    auth: string,
  ) => void
  getSubscriptionsByUserId: (userId: string) => PushSubscriptionRow[]
  removeSubscription: (userId: string, endpoint: string) => void
  removeSubscriptionByEndpoint: (endpoint: string) => void
  getAllSubscribedUserIds: () => string[]
  getDisabledCameras: (userId: string) => string[]
  isCameraEnabledForUser: (userId: string, camera: string) => boolean
  setPreference: (userId: string, camera: string, enabled: boolean) => void
  close: () => void
}

export function createPushStore(dbPath: string = DEFAULT_DB_PATH): PushStore {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const db = new Database(dbPath)

  // Enable WAL mode for concurrent reads
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      endpoint   TEXT NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, endpoint)
    );

    CREATE TABLE IF NOT EXISTS push_notification_preferences (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      category    TEXT NOT NULL,
      resource_id TEXT,
      enabled     INTEGER NOT NULL DEFAULT 1,
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, category, resource_id)
    );
  `)

  const stmts = {
    upsert: db.prepare(`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth
    `),
    getByUser: db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?'),
    remove: db.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    ),
    removeByEndpoint: db.prepare(
      'DELETE FROM push_subscriptions WHERE endpoint = ?',
    ),
    allUserIds: db.prepare('SELECT DISTINCT user_id FROM push_subscriptions'),
    disabledCameras: db.prepare(
      `SELECT resource_id FROM push_notification_preferences
       WHERE user_id = ? AND category = 'camera' AND enabled = 0`,
    ),
    isCameraEnabled: db.prepare(
      `SELECT enabled FROM push_notification_preferences
       WHERE user_id = ? AND category = 'camera' AND resource_id = ?`,
    ),
    upsertPref: db.prepare(`
      INSERT INTO push_notification_preferences (user_id, category, resource_id, enabled)
      VALUES (?, 'camera', ?, ?)
      ON CONFLICT(user_id, category, resource_id) DO UPDATE SET
        enabled = excluded.enabled,
        updated_at = datetime('now')
    `),
  }

  return {
    db,

    saveSubscription(userId, endpoint, p256dh, auth) {
      stmts.upsert.run(userId, endpoint, p256dh, auth)
    },

    getSubscriptionsByUserId(userId) {
      return stmts.getByUser.all(userId) as PushSubscriptionRow[]
    },

    removeSubscription(userId, endpoint) {
      stmts.remove.run(userId, endpoint)
    },

    removeSubscriptionByEndpoint(endpoint) {
      stmts.removeByEndpoint.run(endpoint)
    },

    getAllSubscribedUserIds() {
      const rows = stmts.allUserIds.all() as { user_id: string }[]
      return rows.map((r) => r.user_id)
    },

    getDisabledCameras(userId) {
      const rows = stmts.disabledCameras.all(userId) as {
        resource_id: string
      }[]
      return rows.map((r) => r.resource_id)
    },

    isCameraEnabledForUser(userId, camera) {
      const row = stmts.isCameraEnabled.get(userId, camera) as
        | { enabled: number }
        | undefined
      // No row = default enabled (opt-out model)
      return row === undefined || row.enabled === 1
    },

    setPreference(userId, camera, enabled) {
      stmts.upsertPref.run(userId, camera, enabled ? 1 : 0)
    },

    close() {
      db.close()
    },
  }
}

/** Lazily initialized singleton store for production use. */
let _store: PushStore | null = null

export function getPushStore(): PushStore {
  if (!_store) {
    _store = createPushStore()
  }
  return _store
}
