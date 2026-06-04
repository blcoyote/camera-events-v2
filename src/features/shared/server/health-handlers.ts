import '@tanstack/react-start/server-only'
import { openSqlite } from '#/features/shared/server/sqlite'
import { existsSync } from 'node:fs'

const DEFAULT_DB_PATH = 'data/camera-events.db'
const DB_CHECK_CACHE_TTL_MS = 5_000

interface DbCheckCache {
  result: { status: 'ok' | 'error'; message?: string }
  path: string
  expiresAt: number
}

let dbCheckCache: DbCheckCache | null = null

export function _clearDbCheckCache(): void {
  dbCheckCache = null
}

export interface LivenessResult {
  status: 'ok'
  timestamp: string
}

export interface ReadinessResult {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: {
    database: { status: 'ok' | 'error'; message?: string }
    mqtt: { status: 'configured' | 'not_configured' }
  }
}

export function handleLiveness(): { status: number; body: LivenessResult } {
  return {
    status: 200,
    body: { status: 'ok', timestamp: new Date().toISOString() },
  }
}

async function checkDatabase(
  dbPath: string,
): Promise<{ status: 'ok' | 'error'; message?: string }> {
  if (!existsSync(dbPath)) {
    return { status: 'ok' }
  }
  const db = await openSqlite(dbPath)
  try {
    db.prepare('SELECT 1').get()
    return { status: 'ok' }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown database error',
    }
  } finally {
    db.close()
  }
}

function checkMqtt(): { status: 'configured' | 'not_configured' } {
  const configured =
    process.env.MQTT_URL !== undefined && process.env.FRIGATE_MOCK !== 'true'
  return { status: configured ? 'configured' : 'not_configured' }
}

async function checkDatabaseCached(
  dbPath: string,
): Promise<{ status: 'ok' | 'error'; message?: string }> {
  const now = Date.now()
  if (
    dbCheckCache &&
    dbCheckCache.path === dbPath &&
    dbCheckCache.expiresAt > now
  ) {
    return dbCheckCache.result
  }
  const result = await checkDatabase(dbPath)
  dbCheckCache = {
    result,
    path: dbPath,
    expiresAt: now + DB_CHECK_CACHE_TTL_MS,
  }
  return result
}

export async function handleReadiness(
  dbPath = DEFAULT_DB_PATH,
): Promise<{ status: number; body: ReadinessResult }> {
  let database: { status: 'ok' | 'error'; message?: string }
  try {
    database = await checkDatabaseCached(dbPath)
  } catch (err) {
    database = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown database error',
    }
  }
  const mqtt = checkMqtt()
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
