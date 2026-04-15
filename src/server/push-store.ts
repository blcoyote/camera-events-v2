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
  saveSubscription: (userId: string, endpoint: string, p256dh: string, auth: string) => void
  getSubscriptionsByUserId: (userId: string) => PushSubscriptionRow[]
  removeSubscription: (userId: string, endpoint: string) => void
  removeSubscriptionByEndpoint: (endpoint: string) => void
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
    getByUser: db.prepare(
      'SELECT * FROM push_subscriptions WHERE user_id = ?',
    ),
    remove: db.prepare(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
    ),
    removeByEndpoint: db.prepare(
      'DELETE FROM push_subscriptions WHERE endpoint = ?',
    ),
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
