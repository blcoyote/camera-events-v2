import '@tanstack/react-start/server-only'
import { openSqlite } from '#/features/shared/server/sqlite'
import { existsSync } from 'node:fs'
import { log } from '#/features/shared/server/log'

const DEFAULT_DB_PATH = 'data/camera-events.db'
const DB_CHECK_CACHE_TTL_MS = 5_000

type DbCheckResult = { status: 'ok' | 'error' }

interface DbCheckCache {
  result: DbCheckResult
  path: string
  expiresAt: number
}

let dbCheckCache: DbCheckCache | null = null
let dbCheckInFlight: { path: string; promise: Promise<DbCheckResult> } | null =
  null

export function _clearDbCheckCache(): void {
  dbCheckCache = null
}

export interface LivenessResult {
  status: 'ok'
  timestamp: string
}

export interface ReadinessResult {
  status: 'ok' | 'degraded'
}

export function handleLiveness(): { status: number; body: LivenessResult } {
  return {
    status: 200,
    body: { status: 'ok', timestamp: new Date().toISOString() },
  }
}

function dbError(err: unknown): DbCheckResult {
  const detail = err instanceof Error ? err.message : String(err)
  log.error('health', 'Readiness DB check failed', err, { detail })
  return { status: 'error' }
}

async function checkDatabase(dbPath: string): Promise<DbCheckResult> {
  if (!existsSync(dbPath)) return { status: 'ok' }
  try {
    const db = await openSqlite(dbPath)
    try {
      db.prepare('SELECT 1').get()
      return { status: 'ok' }
    } catch (err) {
      return dbError(err)
    } finally {
      db.close()
    }
  } catch (err) {
    return dbError(err)
  }
}

async function checkDatabaseCached(dbPath: string): Promise<DbCheckResult> {
  const now = Date.now()
  if (
    dbCheckCache &&
    dbCheckCache.path === dbPath &&
    dbCheckCache.expiresAt > now
  ) {
    return dbCheckCache.result
  }
  if (dbCheckInFlight && dbCheckInFlight.path === dbPath) {
    return dbCheckInFlight.promise
  }
  const promise = checkDatabase(dbPath)
    .then((result) => {
      dbCheckCache = {
        result,
        path: dbPath,
        expiresAt: Date.now() + DB_CHECK_CACHE_TTL_MS,
      }
      return result
    })
    .finally(() => {
      if (dbCheckInFlight?.path === dbPath) dbCheckInFlight = null
    })
  dbCheckInFlight = { path: dbPath, promise }
  return promise
}

export async function handleReadiness(
  dbPath = DEFAULT_DB_PATH,
): Promise<{ status: number; body: ReadinessResult }> {
  const healthy = (await checkDatabaseCached(dbPath)).status === 'ok'
  return {
    status: healthy ? 200 : 503,
    body: { status: healthy ? 'ok' : 'degraded' },
  }
}
