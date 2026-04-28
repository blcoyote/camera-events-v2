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
  run: (...params: unknown[]) => unknown
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
}

export interface SqliteDatabase {
  prepare: (sql: string) => SqliteStatement
  exec: (sql: string) => void
  /** Read a PRAGMA value. Returns rows in `[{ name: value }]` form. */
  pragmaRead: (name: string) => unknown[]
  /** Set a PRAGMA value. No return. */
  pragmaWrite: (stmt: string) => void
  close: () => void
}

function isBunRuntime(): boolean {
  return (
    typeof process !== 'undefined' && typeof process.versions.bun === 'string'
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
        run: (...params) => stmt.run(...params),
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params),
      }
    },
    exec(sql) {
      db.exec(sql)
    },
    pragmaRead(name) {
      // better-sqlite3's `pragma()` returns an array of row objects for
      // read pragmas; normalize via prepare().all() so both drivers agree.
      return db.prepare(`PRAGMA ${name}`).all()
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

/**
 * Minimal type surface for the `bun:sqlite` API we depend on. We don't
 * pull in `@types/bun` just for this; declaring the shape here keeps
 * Node-side tsc happy without adding a transitive dependency.
 */
interface BunSqliteStatement {
  run: (...params: unknown[]) => unknown
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
}
interface BunSqliteDatabase {
  prepare: (sql: string) => BunSqliteStatement
  run: (sql: string, ...params: unknown[]) => unknown
  close: () => void
}
interface BunSqliteModule {
  Database: new (
    filename: string,
    options?: { create?: boolean },
  ) => BunSqliteDatabase
}

/**
 * Lazily resolved `bun:sqlite` module. The dynamic import happens on
 * first openSqlite call on Bun, then the result is cached so subsequent
 * opens don't re-pay the import cost.
 *
 * Why dynamic import: `bun:sqlite` is a Bun built-in and is unresolvable
 * under Node, where vitest runs. A static import would fail at module
 * load. The dynamic form keeps the Node branch safe and only evaluates
 * the bun: scheme when we know we're on Bun.
 */
let bunSqliteModulePromise: Promise<BunSqliteModule> | null = null

async function loadBunSqlite(): Promise<BunSqliteModule> {
  if (!bunSqliteModulePromise) {
    bunSqliteModulePromise = (async () => {
      try {
        // @vite-ignore — bun:sqlite is a Bun-only built-in; we route
        // the dynamic import through a string so Vite/Node bundlers
        // won't try to statically resolve it during the Node-side test
        // build.
        const specifier = 'bun:sqlite'
        return (await import(/* @vite-ignore */ specifier)) as BunSqliteModule
      } catch (err) {
        throw new Error(
          `bun:sqlite is not available in this runtime. ` +
            `Expected to run on Bun but the import failed: ` +
            (err instanceof Error ? err.message : String(err)),
        )
      }
    })()
  }
  return bunSqliteModulePromise
}

async function openBunSqlite(dbPath: string): Promise<SqliteDatabase> {
  const { Database } = await loadBunSqlite()
  const db = new Database(dbPath, { create: true })

  return {
    prepare(sql) {
      const stmt = db.prepare(sql)
      return {
        run: (...params) => stmt.run(...(params as [])),
        get: (...params) => stmt.get(...(params as [])),
        all: (...params) => stmt.all(...(params as [])),
      }
    },
    exec(sql) {
      // bun:sqlite's run() executes SQL directly; exec is an alias of run
      // in bun:sqlite, so this matches better-sqlite3's exec semantics
      // for our usage (multi-statement DDL).
      db.run(sql)
    },
    pragmaRead(name) {
      return db.prepare(`PRAGMA ${name}`).all()
    },
    pragmaWrite(stmt) {
      db.run(`PRAGMA ${stmt}`)
    },
    close() {
      db.close()
    },
  }
}
