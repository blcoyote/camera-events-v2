interface SqliteStatement {
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

export async function openSqlite(path: string): Promise<SqliteDatabase> {
  const { default: Database } = await import('better-sqlite3')
  const db = new Database(path)
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
