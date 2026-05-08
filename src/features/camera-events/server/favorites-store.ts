import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { openSqlite } from '#/features/shared/server/sqlite'
import type { SqliteDatabase } from '#/features/shared/server/sqlite'

const DEFAULT_DB_PATH = 'data/camera-events.db'

export interface FavoritesStore {
  addFavorite: (userId: string, eventId: string) => void
  removeFavorite: (userId: string, eventId: string) => void
  isFavorited: (userId: string, eventId: string) => boolean
  getFavoritedEventIds: (userId: string) => string[]
  /** Inspection helper for tests: list table names. */
  tableNames: () => string[]
  /** Inspection helper for tests: list column names of `table`. */
  tableColumns: (table: string) => string[]
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
    CREATE TABLE IF NOT EXISTS favorite_events (
      user_id    TEXT NOT NULL,
      event_id   TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, event_id)
    );
  `)

  const stmts = {
    add: db.prepare(
      'INSERT OR IGNORE INTO favorite_events (user_id, event_id) VALUES (?, ?)',
    ),
    remove: db.prepare(
      'DELETE FROM favorite_events WHERE user_id = ? AND event_id = ?',
    ),
    isFavorited: db.prepare(
      'SELECT 1 FROM favorite_events WHERE user_id = ? AND event_id = ?',
    ),
    getByUser: db.prepare(
      'SELECT event_id FROM favorite_events WHERE user_id = ?',
    ),
  }

  return {
    addFavorite(userId, eventId) {
      stmts.add.run(userId, eventId)
    },

    removeFavorite(userId, eventId) {
      stmts.remove.run(userId, eventId)
    },

    isFavorited(userId, eventId) {
      return stmts.isFavorited.get(userId, eventId) != null
    },

    getFavoritedEventIds(userId) {
      const rows = stmts.getByUser.all(userId) as { event_id: string }[]
      return rows.map((r) => r.event_id)
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
      return db.prepare(sql).all(...params).length
    },

    close() {
      db.close()
    },
  }
}

let _storePromise: Promise<FavoritesStore> | null = null

export function getFavoritesStore(): Promise<FavoritesStore> {
  if (!_storePromise) {
    _storePromise = createFavoritesStore()
  }
  return _storePromise
}
