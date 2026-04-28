/**
 * Runtime-portable SQLite driver.
 *
 * Production runs on Bun (`nitro({ preset: 'bun' })`). Tests run on Node
 * (vitest). `better-sqlite3` is a native N-API addon that crashes on Bun
 * (oven-sh/bun#4290), so this module branches at runtime: Node uses
 * `better-sqlite3`, Bun uses the built-in `bun:sqlite`. Both branches
 * expose the same `SqliteDatabase` shape so callers don't care which
 * driver is underneath.
 *
 * Operator note: the WAL/SHM file ownership differs between drivers. Do
 * not run a Node dev server and a Bun production server concurrently
 * against the same database file.
 */

export interface SqliteStatement {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement
  exec(sql: string): void
  /** Read a PRAGMA value. Returns rows in `[{ name: value }]` form. */
  pragmaRead(name: string): unknown[]
  /** Set a PRAGMA value. No return. */
  pragmaWrite(stmt: string): void
  close(): void
}

function isBunRuntime(): boolean {
  return (
    typeof process !== 'undefined' && typeof process.versions?.bun === 'string'
  )
}

/**
 * Opens a SQLite database at `path`, choosing the driver based on the
 * current runtime. Async because the Bun branch lazily imports
 * `bun:sqlite` (a Bun-only built-in that would fail to resolve under
 * Node).
 */
export async function openSqlite(path: string): Promise<SqliteDatabase> {
  if (isBunRuntime()) {
    return openBunSqlite(path)
  }
  return openNodeSqlite(path)
}

// --- Node branch (better-sqlite3) ---------------------------------------

async function openNodeSqlite(dbPath: string): Promise<SqliteDatabase> {
  const { default: Database } = await import('better-sqlite3')
  const db = new Database(dbPath)
  return {
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        run: (...params) => stmt.run(...(params as unknown[])),
        get: (...params) => stmt.get(...(params as unknown[])),
        all: (...params) => stmt.all(...(params as unknown[])) as unknown[],
      }
    },
    exec(sql) {
      db.exec(sql)
    },
    pragmaRead(name) {
      // better-sqlite3's `pragma()` returns an array of row objects for
      // read pragmas; normalize via prepare().all() so both drivers agree.
      return db.prepare(`PRAGMA ${name}`).all() as unknown[]
    },
    pragmaWrite(stmt) {
      db.exec(`PRAGMA ${stmt}`)
    },
    close() {
      db.close()
    },
  }
}

// --- Bun branch (bun:sqlite) --------------------------------------------

async function openBunSqlite(_dbPath: string): Promise<SqliteDatabase> {
  throw new Error(
    'openSqlite Bun branch is not implemented yet — added in the next step',
  )
}
