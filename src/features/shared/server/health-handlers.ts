import '@tanstack/react-start/server-only'
import { openSqlite } from '#/features/shared/server/sqlite'
import { existsSync } from 'node:fs'

const DEFAULT_DB_PATH = 'data/camera-events.db'
const DB_CHECK_CACHE_TTL_MS = 5_000

type DbCheckResult = { status: 'ok' | 'error'; message?: string }

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

export type MqttStatus = 'connected' | 'disconnected' | 'not_configured'

export interface ReadinessResult {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: {
    database: { status: 'ok' | 'error'; message?: string }
    mqtt: { status: MqttStatus }
  }
}

export function handleLiveness(): { status: number; body: LivenessResult } {
  return {
    status: 200,
    body: { status: 'ok', timestamp: new Date().toISOString() },
  }
}

const GENERIC_DB_ERROR_MESSAGE = 'Database check failed'

function dbError(err: unknown): DbCheckResult {
  const detail = err instanceof Error ? err.message : String(err)
  console.error(`Readiness DB check failed: ${detail}`)
  return { status: 'error', message: GENERIC_DB_ERROR_MESSAGE }
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
  getMqttState: () => MqttStatus = () => 'not_configured',
): Promise<{ status: number; body: ReadinessResult }> {
  const database = await checkDatabaseCached(dbPath)
  const mqtt = { status: getMqttState() }
  const healthy = database.status === 'ok'

  return {
    status: healthy ? 200 : 503,
    body: {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database, mqtt },
    },
  }
}
