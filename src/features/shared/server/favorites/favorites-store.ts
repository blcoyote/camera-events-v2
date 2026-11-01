import '@tanstack/react-start/server-only'
import { openSqlite } from '#/features/shared/server/sqlite'
import type { SqliteDatabase } from '#/features/shared/server/sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_DB_PATH = 'data/camera-events.db'

export interface FavoritesStore {
  addFavorite: (userId: string, eventId: string) => void
  removeFavorite: (userId: string, eventId: string) => void
  getUserFavoritedEventIds: (userId: string) => string[]
  isFavorited: (userId: string, eventId: string) => boolean
  getReferenceCount: (eventId: string) => number
  addShare: (eventId: string, senderId: string, recipientId: string) => void
  removeSharesForRecipient: (recipientId: string, eventId: string) => void
  getSharesForRecipient: (
    recipientId: string,
  ) => Array<{ eventId: string; senderId: string; createdAt: string }>
  getFavoritesWithTime: (
    userId: string,
  ) => Array<{ eventId: string; createdAt: string }>
  /** Inspection helper for tests: list table names. */
  tableNames: () => string[]
  /** Inspection helper for tests: count rows matching SQL + params. */
  countRows: (sql: string, ...params: unknown[]) => number
  close: () => void
}

export async function createFavoritesStore(
  dbPath: string = DEFAULT_DB_PATH,
): Promise<FavoritesStore> {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const db: SqliteDatabase = await openSqlite(dbPath)

  db.pragmaWrite('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_favorites (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      event_id   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, event_id)
    );
    CREATE TABLE IF NOT EXISTS event_shares (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id     TEXT NOT NULL,
      sender_id    TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id, sender_id, recipient_id)
    );
    CREATE INDEX IF NOT EXISTS idx_event_shares_recipient ON event_shares(recipient_id);
  `)

  const stmts = {
    add: db.prepare(
      'INSERT OR IGNORE INTO event_favorites (user_id, event_id) VALUES (?, ?)',
    ),
    remove: db.prepare(
      'DELETE FROM event_favorites WHERE user_id = ? AND event_id = ?',
    ),
    getByUser: db.prepare(
      'SELECT event_id FROM event_favorites WHERE user_id = ?',
    ),
    check: db.prepare(
      'SELECT 1 FROM event_favorites WHERE user_id = ? AND event_id = ? LIMIT 1',
    ),
    count: db.prepare(
      `SELECT (SELECT COUNT(*) FROM event_favorites WHERE event_id = ?)
            + (SELECT COUNT(*) FROM event_shares WHERE event_id = ?) AS n`,
    ),
    addShare: db.prepare(
      `INSERT INTO event_shares (event_id, sender_id, recipient_id) VALUES (?, ?, ?)
       ON CONFLICT(event_id, sender_id, recipient_id) DO UPDATE SET created_at = datetime('now')`,
    ),
    removeShares: db.prepare(
      'DELETE FROM event_shares WHERE recipient_id = ? AND event_id = ?',
    ),
    sharesFor: db.prepare(
      'SELECT event_id, sender_id, created_at FROM event_shares WHERE recipient_id = ? ORDER BY created_at ASC, id ASC',
    ),
    favsWithTime: db.prepare(
      'SELECT event_id, created_at FROM event_favorites WHERE user_id = ?',
    ),
  }

  return {
    addFavorite(userId, eventId) {
      stmts.add.run(userId, eventId)
    },

    removeFavorite(userId, eventId) {
      stmts.remove.run(userId, eventId)
    },

    getUserFavoritedEventIds(userId) {
      const rows = stmts.getByUser.all(userId) as { event_id: string }[]
      return rows.map((r) => r.event_id)
    },

    isFavorited(userId, eventId) {
      const row = stmts.check.get(userId, eventId)
      return row != null
    },

    getReferenceCount(eventId) {
      return (stmts.count.get(eventId, eventId) as { n: number }).n
    },

    addShare(eventId, senderId, recipientId) {
      stmts.addShare.run(eventId, senderId, recipientId)
    },

    removeSharesForRecipient(recipientId, eventId) {
      stmts.removeShares.run(recipientId, eventId)
    },

    getSharesForRecipient(recipientId) {
      const rows = stmts.sharesFor.all(recipientId) as Array<{
        event_id: string
        sender_id: string
        created_at: string
      }>
      return rows.map((r) => ({
        eventId: r.event_id,
        senderId: r.sender_id,
        createdAt: r.created_at,
      }))
    },

    getFavoritesWithTime(userId) {
      const rows = stmts.favsWithTime.all(userId) as Array<{
        event_id: string
        created_at: string
      }>
      return rows.map((r) => ({ eventId: r.event_id, createdAt: r.created_at }))
    },

    tableNames() {
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>
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
let _storePromise: Promise<FavoritesStore> | null = null

export function getFavoritesStore(): Promise<FavoritesStore> {
  if (!_storePromise) {
    _storePromise = createFavoritesStore()
  }
  return _storePromise
}
