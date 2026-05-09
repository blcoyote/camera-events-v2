/**
 * Bun-runtime test for openSqlite.
 *
 * Skipped automatically when not running on Bun. Run manually with
 *   bun test src/features/shared/server/sqlite/sqlite.bun-runtime.test.ts
 * before merging Bun-related changes. Capture the output in the PR
 * description as the manual gate evidence (see plan Step 5).
 *
 * Companion: sqlite.bun-branch.test.ts (mock-driven, runs in CI on Node).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openSqlite } from './index'
import type { SqliteDatabase } from './index'

const isBun = typeof process !== 'undefined' && !!process.versions.bun

describe.skipIf(!isBun)('openSqlite real Bun runtime', () => {
  let db: SqliteDatabase
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-bun-runtime-'))
    db = await openSqlite(path.join(tmpDir, 'test.db'))
  })

  afterEach(() => {
    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('round-trips data through prepare/run/all', () => {
    db.exec(`CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)`)
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
    db.exec(`CREATE TABLE k (id INTEGER PRIMARY KEY, v TEXT)`)
    db.prepare('INSERT INTO k (id, v) VALUES (?, ?)').run(1, 'one')

    const present = db.prepare('SELECT v FROM k WHERE id = ?').get(1) as
      | { v: string }
      | undefined
    expect(present).toEqual({ v: 'one' })

    const missing = db.prepare('SELECT v FROM k WHERE id = ?').get(999)
    expect(missing).toBeUndefined()
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

    db = await openSqlite(path.join(tmpDir, 'fresh.db'))
  })
})
