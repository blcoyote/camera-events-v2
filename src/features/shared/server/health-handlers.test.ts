import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleLiveness,
  handleReadiness,
  _clearDbCheckCache,
} from './health-handlers'
import { openSqlite } from '#/features/shared/server/sqlite'
import { existsSync } from 'node:fs'

vi.mock('#/features/shared/server/sqlite', () => ({
  openSqlite: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  _clearDbCheckCache()
})

describe('handleLiveness', () => {
  it('returns 200 with status ok', () => {
    const result = handleLiveness()
    expect(result.status).toBe(200)
    expect(result.body.status).toBe('ok')
  })

  it('includes an ISO timestamp', () => {
    const before = Date.now()
    const result = handleLiveness()
    const after = Date.now()
    const ts = new Date(result.body.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('handleReadiness', () => {
  const originalMqttUrl = process.env.MQTT_URL
  const originalFrigateMock = process.env.FRIGATE_MOCK

  afterEach(() => {
    if (originalMqttUrl === undefined) delete process.env.MQTT_URL
    else process.env.MQTT_URL = originalMqttUrl

    if (originalFrigateMock === undefined) delete process.env.FRIGATE_MOCK
    else process.env.FRIGATE_MOCK = originalFrigateMock
  })

  it('returns 200 when DB file does not exist yet', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    delete process.env.MQTT_URL

    const result = await handleReadiness('/tmp/nonexistent.db')

    expect(result.status).toBe(200)
    expect(result.body.status).toBe('ok')
    expect(result.body.checks.database.status).toBe('ok')
  })

  it('returns 200 when DB is accessible', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      close: vi.fn(),
    }
    vi.mocked(openSqlite).mockResolvedValue(mockDb as never)
    delete process.env.MQTT_URL

    const result = await handleReadiness('/tmp/existing.db')

    expect(result.status).toBe(200)
    expect(result.body.status).toBe('ok')
    expect(result.body.checks.database.status).toBe('ok')
    expect(mockDb.close).toHaveBeenCalled()
  })

  it('returns 503 when DB open fails', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(openSqlite).mockRejectedValue(new Error('SQLITE_CANTOPEN'))
    delete process.env.MQTT_URL
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await handleReadiness('/tmp/bad.db')

    expect(result.status).toBe(503)
    expect(result.body.status).toBe('degraded')
    expect(result.body.checks.database.status).toBe('error')
    expect(result.body.checks.database.message).not.toContain('SQLITE_CANTOPEN')
    expect(result.body.checks.database.message).toBe('Database check failed')
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('SQLITE_CANTOPEN'),
    )

    errSpy.mockRestore()
  })

  it('closes the DB even when query throws', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockImplementation(() => {
          throw new Error('disk I/O error')
        }),
      }),
      close: vi.fn(),
    }
    vi.mocked(openSqlite).mockResolvedValue(mockDb as never)
    delete process.env.MQTT_URL
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await handleReadiness('/tmp/bad.db')

    expect(result.body.checks.database.status).toBe('error')
    expect(result.body.checks.database.message).not.toContain('disk I/O error')
    expect(result.body.checks.database.message).toBe('Database check failed')
    expect(mockDb.close).toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('disk I/O error'),
    )

    errSpy.mockRestore()
  })

  it('reports the injected mqtt state', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const connected = await handleReadiness(
      '/tmp/nonexistent.db',
      () => 'connected',
    )
    expect(connected.body.checks.mqtt.status).toBe('connected')

    _clearDbCheckCache()

    const disconnected = await handleReadiness(
      '/tmp/nonexistent.db',
      () => 'disconnected',
    )
    expect(disconnected.body.checks.mqtt.status).toBe('disconnected')

    _clearDbCheckCache()

    const notConfigured = await handleReadiness(
      '/tmp/nonexistent.db',
      () => 'not_configured',
    )
    expect(notConfigured.body.checks.mqtt.status).toBe('not_configured')
  })

  it('defaults mqtt to not_configured when no getter is provided', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const result = await handleReadiness('/tmp/nonexistent.db')

    expect(result.body.checks.mqtt.status).toBe('not_configured')
  })

  it('includes an ISO timestamp', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    delete process.env.MQTT_URL

    const before = Date.now()
    const result = await handleReadiness('/tmp/nonexistent.db')
    const after = Date.now()

    const ts = new Date(result.body.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})

describe('handleReadiness — DB check caching', () => {
  afterEach(() => {
    vi.useRealTimers()
    _clearDbCheckCache()
  })

  it('coalesces concurrent requests into a single DB call', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      close: vi.fn(),
    }
    vi.mocked(openSqlite).mockResolvedValue(mockDb as never)

    await Promise.all([
      handleReadiness('/tmp/db.db'),
      handleReadiness('/tmp/db.db'),
      handleReadiness('/tmp/db.db'),
    ])

    expect(openSqlite).toHaveBeenCalledTimes(1)
  })

  it('queries the DB only once within the cache TTL window', async () => {
    vi.useFakeTimers()
    vi.mocked(existsSync).mockReturnValue(true)
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      close: vi.fn(),
    }
    vi.mocked(openSqlite).mockResolvedValue(mockDb as never)

    await handleReadiness('/tmp/db.db')
    await handleReadiness('/tmp/db.db')
    await handleReadiness('/tmp/db.db')

    expect(openSqlite).toHaveBeenCalledTimes(1)
  })

  it('re-queries the DB after the cache TTL expires', async () => {
    vi.useFakeTimers()
    vi.mocked(existsSync).mockReturnValue(true)
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      close: vi.fn(),
    }
    vi.mocked(openSqlite).mockResolvedValue(mockDb as never)

    await handleReadiness('/tmp/db.db')
    vi.advanceTimersByTime(6_000)
    await handleReadiness('/tmp/db.db')

    expect(openSqlite).toHaveBeenCalledTimes(2)
  })
})
