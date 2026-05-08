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
  getFavoriteCount: (eventId: string) => number
  /** Atomically toggles the favorite and returns the new state + remaining
   *  count. Runs inside a BEGIN IMMEDIATE transaction so concurrent
   *  unfavorites cannot both see count===0 and both trigger unretain. */
  atomicToggleFavorite: (
    userId: string,
    eventId: string,
  ) => { isFavorited: boolean; remainingCount: number }
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
    countByEvent: db.prepare(
      'SELECT COUNT(*) as count FROM favorite_events WHERE event_id = ?',
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

    getFavoriteCount(eventId) {
      const row = stmts.countByEvent.get(eventId) as { count: number }
      return row.count
    },

    atomicToggleFavorite(userId, eventId) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const wasFavorited = stmts.isFavorited.get(userId, eventId) != null
        if (wasFavorited) {
          stmts.remove.run(userId, eventId)
        } else {
          stmts.add.run(userId, eventId)
        }
        const row = stmts.countByEvent.get(eventId) as { count: number }
        db.exec('COMMIT')
        return { isFavorited: !wasFavorited, remainingCount: row.count }
      } catch (e) {
        try {
          db.exec('ROLLBACK')
        } catch {
          /* already rolled back */
        }
        throw e
      }
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
