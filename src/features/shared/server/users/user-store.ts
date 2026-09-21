import '@tanstack/react-start/server-only'
import { openSqlite } from '#/features/shared/server/sqlite'
import type { SqliteDatabase } from '#/features/shared/server/sqlite'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_DB_PATH = 'data/camera-events.db'

export interface UserRow {
  sub: string
  email: string
  first_name: string | null
  avatar_url: string | null
  is_admin: number
  created_at: string
  last_login_at: string
}

export interface UserStore {
  /** Insert on first login, refresh profile + last_login_at on return visits. Never changes is_admin or created_at. */
  upsertUser: (user: {
    sub: string
    email: string
    firstName: string
    avatarUrl: string
  }) => void
  getUser: (sub: string) => UserRow | null
  /** Authorization read. Anything that is not a stored 1 is false. */
  isAdmin: (sub: string) => boolean
  setAdmin: (sub: string, isAdmin: boolean) => void
  /** Idempotent promote-only helper used by the login seeding path. */
  promoteToAdmin: (sub: string) => void
  /** Inspection helper for tests: list table names. */
  tableNames: () => string[]
  /** Inspection helper for tests: list column names of `table`. */
  tableColumns: (table: string) => string[]
  /** Inspection helper for tests: count rows matching SQL + params. */
  countRows: (sql: string, ...params: unknown[]) => number
  close: () => void
}

/**
 * Coerce a raw DB is_admin value to a boolean. Fail-closed: only 1 / true
 * (or their string forms) count as admin. Everything else — including
 * null, undefined, 0, '0', '', false, and unexpected types — is false.
 */
export function toIsAdmin(value: unknown): boolean {
  return value === 1 || value === '1' || value === true
}

export async function createUserStore(
  dbPath: string = DEFAULT_DB_PATH,
): Promise<UserStore> {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const db: SqliteDatabase = await openSqlite(dbPath)

  db.pragmaWrite('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      sub           TEXT PRIMARY KEY,
      email         TEXT NOT NULL,
      first_name    TEXT,
      avatar_url    TEXT,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const stmts = {
    upsert: db.prepare(`
      INSERT INTO users (sub, email, first_name, avatar_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(sub) DO UPDATE SET
        email = excluded.email,
        first_name = excluded.first_name,
        avatar_url = excluded.avatar_url,
        last_login_at = datetime('now')
    `),
    getBySub: db.prepare('SELECT * FROM users WHERE sub = ?'),
    setAdmin: db.prepare('UPDATE users SET is_admin = ? WHERE sub = ?'),
    promote: db.prepare(
      'UPDATE users SET is_admin = 1 WHERE sub = ? AND is_admin != 1',
    ),
  }

  return {
    upsertUser({ sub, email, firstName, avatarUrl }) {
      stmts.upsert.run(sub, email, firstName, avatarUrl)
    },

    getUser(sub) {
      const row = stmts.getBySub.get(sub) as UserRow | undefined
      return row ?? null
    },

    isAdmin(sub) {
      const row = stmts.getBySub.get(sub) as UserRow | undefined
      if (!row) return false
      return toIsAdmin(row.is_admin)
    },

    setAdmin(sub, isAdmin) {
      stmts.setAdmin.run(isAdmin ? 1 : 0, sub)
    },

    promoteToAdmin(sub) {
      stmts.promote.run(sub)
    },

    tableNames() {
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>
      return rows.map((r) => r.name)
    },

    tableColumns(table) {
      const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
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
let _storePromise: Promise<UserStore> | null = null

export function getUserStore(): Promise<UserStore> {
  if (!_storePromise) {
    _storePromise = createUserStore()
  }
  return _storePromise
}
