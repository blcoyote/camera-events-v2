import '@tanstack/react-start/server-only'
import { openSqlite } from '#/features/shared/server/sqlite'
import type { SqliteDatabase } from '#/features/shared/server/sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_DB_PATH = 'data/camera-events.db'

interface PushSubscriptionRow {
  id: number
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

export interface PushStore {
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
  /** Inspection helper for tests: list user table names. */
  tableNames: () => string[]
  /** Inspection helper for tests: list column names of `table`. */
  tableColumns: (table: string) => string[]
  /** Inspection helper for tests: count rows matching SQL + params. */
  countRows: (sql: string, ...params: unknown[]) => number
  close: () => void
}

export async function createPushStore(
  dbPath: string = DEFAULT_DB_PATH,
): Promise<PushStore> {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const db: SqliteDatabase = await openSqlite(dbPath)

  // Enable WAL mode for concurrent reads
  db.pragmaWrite('journal_mode = WAL')

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
        | null
        | undefined
      // No row = default enabled (opt-out model)
      return row == null || row.enabled === 1
    },

    setPreference(userId, camera, enabled) {
      stmts.upsertPref.run(userId, camera, enabled ? 1 : 0)
    },

    tableNames() {
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>
      return rows.map((r) => r.name)
    },

    tableColumns(table) {
      const rows = db.pragmaRead(`table_info(${table})`) as Array<{
        name: string
      }>
      return rows.map((r) => r.name)
    },

    countRows(sql, ...params) {
      const rows = db.prepare(sql).all(...params)
      return rows.length
    },

    close() {
      db.close()
    },
  }
}

/** Lazily initialized singleton store for production use. */
let _storePromise: Promise<PushStore> | null = null

export function getPushStore(): Promise<PushStore> {
  if (!_storePromise) {
    const dbPath = process.env.PUSH_DB_PATH ?? DEFAULT_DB_PATH
    _storePromise = createPushStore(dbPath).catch((err) => {
      _storePromise = null
      throw err
    })
  }
  return _storePromise
}
