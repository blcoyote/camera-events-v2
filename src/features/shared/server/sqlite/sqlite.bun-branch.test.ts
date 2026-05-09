/**
 * Mock-driven verification of the Bun branch of openSqlite.
 *
 * Runs in CI on Node. Fakes `process.versions.bun` and provides a
 * `bun:sqlite` mock so we can exercise the production code path that
 * production Bun will execute, without needing Bun in CI. The companion
 * `sqlite.bun-runtime.test.ts` runs the same shape against the real
 * bun:sqlite under `bun test` as a manual gate.
 *
 * What we verify here:
 *   1. When process.versions.bun is set, openSqlite uses the bun:sqlite
 *      branch (and DOES NOT load better-sqlite3).
 *   2. The wrapper translates SqliteDatabase methods to bun:sqlite calls
 *      with the correct argument shape.
 *   3. Dynamic-import failure of bun:sqlite produces an actionable error
 *      mentioning "bun:sqlite is not available" (covers AC-8).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture better-sqlite3 default-export so we can spy on its constructor.
// If the Bun branch leaks into the Node-driver code, this spy would fire.
const betterSqliteCtor = vi.fn()
vi.mock('better-sqlite3', () => ({
  default: betterSqliteCtor,
}))

// Provide a fake bun:sqlite module. vi.mock is hoisted, so the dynamic
// import('bun:sqlite') inside openSqlite resolves to this fake.
// FakeBunDatabase must be a real constructor (regular function, not arrow)
// so that `new Database(...)` works inside openSqlite.
const fakeStmt = {
  run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
  get: vi.fn(() => ({ value: 'mocked' })),
  all: vi.fn((): unknown[] => [{ value: 'mocked' }]),
}
const fakeDb = {
  prepare: vi.fn(() => fakeStmt),
  run: vi.fn(() => ({ lastInsertRowid: 0, changes: 0 })),
  exec: vi.fn(),
  close: vi.fn(),
}
const FakeBunDatabase = vi.fn(function (this: unknown) {
  return fakeDb
})
vi.mock('bun:sqlite', () => ({
  Database: FakeBunDatabase,
}))

const originalBunVersion = process.versions.bun

beforeEach(() => {
  betterSqliteCtor.mockClear()
  FakeBunDatabase.mockClear()
  fakeDb.prepare.mockClear()
  fakeDb.run.mockClear()
  fakeDb.exec.mockClear()
  fakeDb.close.mockClear()
  fakeStmt.run.mockClear()
  fakeStmt.get.mockClear()
  fakeStmt.all.mockClear()

  // Pretend we're on Bun for the duration of this file's tests.
  Object.defineProperty(process.versions, 'bun', {
    value: '1.x-fake-for-test',
    configurable: true,
    writable: true,
  })
  // Force the module under test to be re-evaluated so any cached
  // bun:sqlite import is re-resolved against the mock.
  vi.resetModules()
})

afterEach(() => {
  if (originalBunVersion === undefined) {
    delete (process.versions as Record<string, unknown>).bun
  } else {
    Object.defineProperty(process.versions, 'bun', {
      value: originalBunVersion,
      configurable: true,
      writable: true,
    })
  }
})

describe('openSqlite Bun branch (mocked bun:sqlite)', () => {
  it('uses bun:sqlite Database when process.versions.bun is set', async () => {
    const { openSqlite } = await import('./index')
    const db = await openSqlite('/tmp/whatever.db')

    expect(FakeBunDatabase).toHaveBeenCalledTimes(1)
    expect(FakeBunDatabase).toHaveBeenCalledWith('/tmp/whatever.db', {
      create: true,
    })
    expect(typeof db.prepare).toBe('function')
  })

  it('does NOT load better-sqlite3 on the Bun branch', async () => {
    const { openSqlite } = await import('./index')
    await openSqlite('/tmp/whatever.db')
    expect(betterSqliteCtor).not.toHaveBeenCalled()
  })

  it('prepare(sql).run/get/all delegate to bun:sqlite Statement', async () => {
    const { openSqlite } = await import('./index')
    const db = await openSqlite('/tmp/whatever.db')

    const stmt = db.prepare('SELECT 1')
    expect(fakeDb.prepare).toHaveBeenCalledWith('SELECT 1')

    stmt.run('a', 'b')
    expect(fakeStmt.run).toHaveBeenCalledWith('a', 'b')

    stmt.get(1)
    expect(fakeStmt.get).toHaveBeenCalledWith(1)

    stmt.all()
    expect(fakeStmt.all).toHaveBeenCalled()
  })

  it('exec delegates to bun:sqlite db.run', async () => {
    const { openSqlite } = await import('./index')
    const db = await openSqlite('/tmp/whatever.db')

    db.exec('CREATE TABLE x (id INTEGER)')
    expect(fakeDb.run).toHaveBeenCalledWith('CREATE TABLE x (id INTEGER)')
  })

  it('pragmaWrite delegates to bun:sqlite db.run with PRAGMA prefix', async () => {
    const { openSqlite } = await import('./index')
    const db = await openSqlite('/tmp/whatever.db')

    db.pragmaWrite('journal_mode = WAL')
    expect(fakeDb.run).toHaveBeenCalledWith('PRAGMA journal_mode = WAL')
  })

  it('pragmaRead returns the bun:sqlite Statement.all() rows', async () => {
    fakeStmt.all.mockReturnValueOnce([{ journal_mode: 'wal' }])

    const { openSqlite } = await import('./index')
    const db = await openSqlite('/tmp/whatever.db')

    const rows = db.pragmaRead('journal_mode')
    expect(fakeDb.prepare).toHaveBeenCalledWith('PRAGMA journal_mode')
    expect(rows).toEqual([{ journal_mode: 'wal' }])
  })

  it('close delegates to bun:sqlite db.close', async () => {
    const { openSqlite } = await import('./index')
    const db = await openSqlite('/tmp/whatever.db')

    db.close()
    expect(fakeDb.close).toHaveBeenCalled()
  })
})

describe('openSqlite Bun branch error path', () => {
  it('throws an actionable error when bun:sqlite cannot be loaded', async () => {
    // Re-mock bun:sqlite to throw on import for this test only.
    vi.doMock('bun:sqlite', () => {
      throw new Error('module not found')
    })
    vi.resetModules()

    const { openSqlite } = await import('./index')

    await expect(openSqlite('/tmp/whatever.db')).rejects.toThrow(
      /bun:sqlite is not available/i,
    )

    vi.doUnmock('bun:sqlite')
  })
})
