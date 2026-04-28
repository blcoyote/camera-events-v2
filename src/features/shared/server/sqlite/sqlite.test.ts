/**
 * Driver-level tests for openSqlite (Node branch via better-sqlite3).
 *
 * Bun branch coverage lives in sqlite.bun-branch.test.ts (mock-driven, runs
 * in CI) and sqlite.bun-runtime.test.ts (real bun:sqlite, run manually
 * under `bun test`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openSqlite, type SqliteDatabase } from './index'

let db: SqliteDatabase
let tmpDir: string

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-driver-'))
  db = await openSqlite(path.join(tmpDir, 'test.db'))
})

afterEach(() => {
  db.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('openSqlite (Node branch)', () => {
  it('exec creates tables and prepare/run/all round-trips data', () => {
    db.exec(`
      CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    `)

    db.prepare('INSERT INTO items (name) VALUES (?)').run('alpha')
    db.prepare('INSERT INTO items (name) VALUES (?)').run('beta')

    const rows = db
      .prepare('SELECT id, name FROM items ORDER BY id')
      .all() as Array<{ id: number; name: string }>

    expect(rows).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ])
  })

  it('prepare(...).get returns a single row or undefined', () => {
    db.exec(`CREATE TABLE k (id INTEGER PRIMARY KEY, v TEXT);`)
    db.prepare('INSERT INTO k (id, v) VALUES (?, ?)').run(1, 'one')

    const present = db.prepare('SELECT v FROM k WHERE id = ?').get(1) as
      | { v: string }
      | undefined
    expect(present).toEqual({ v: 'one' })

    const missing = db.prepare('SELECT v FROM k WHERE id = ?').get(999)
    expect(missing).toBeUndefined()
  })

  it('pragmaRead returns an array of row objects', () => {
    db.exec(`CREATE TABLE x (id INTEGER PRIMARY KEY, v TEXT);`)
    const rows = db.pragmaRead('table_info(x)')
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('pragmaWrite("journal_mode = WAL") enables WAL mode', () => {
    db.pragmaWrite('journal_mode = WAL')
    const rows = db.pragmaRead('journal_mode') as Array<{
      journal_mode: string
    }>
    expect(rows[0].journal_mode).toBe('wal')
  })

  it('close releases the file handle (a second open succeeds)', async () => {
    const dbPath = path.join(tmpDir, 'test.db')
    db.close()

    const reopened = await openSqlite(dbPath)
    try {
      expect(typeof reopened.prepare).toBe('function')
    } finally {
      reopened.close()
    }

    // Re-assign so afterEach close doesn't double-close.
    db = await openSqlite(path.join(tmpDir, 'fresh.db'))
  })
})
