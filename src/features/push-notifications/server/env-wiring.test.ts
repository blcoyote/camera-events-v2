/**
 * Verifies the pipeline reads its tunables from the environment and passes them
 * into the right slots. The resolvers in `env.ts` are tested purely; these tests
 * guard the wiring, which a pure test cannot see (e.g. two duration arguments
 * accidentally swapped).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./event-batcher', () => ({ EventBatcher: vi.fn() }))
vi.mock('./send-throttle', () => ({
  SendThrottle: vi.fn(),
  isAppleEndpoint: vi.fn(() => false),
}))
vi.mock('./push', () => ({
  isPushEnabled: vi.fn(() => false),
  sendPushNotification: vi.fn(),
}))
vi.mock('./push-store', () => ({ getPushStore: vi.fn() }))
vi.mock('mqtt', () => ({
  default: { connect: vi.fn(() => ({ on: vi.fn(), subscribe: vi.fn() })) },
}))

const TUNABLES = [
  'EVENT_BATCH_WINDOW_MS',
  'EVENT_BURST_GAP_MS',
  'APPLE_UPDATE_INTERVAL_MS',
] as const

const originals = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of TUNABLES) {
    originals.set(key, process.env[key])
    delete process.env[key]
  }
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  for (const key of TUNABLES) {
    const value = originals.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('event batcher configuration', () => {
  it('uses the built-in defaults when nothing is set', async () => {
    const { EventBatcher } = await import('./event-batcher')
    await import('./mqtt')

    expect(EventBatcher).toHaveBeenCalledWith(
      expect.any(Function),
      30_000,
      600_000,
    )
  })

  it('takes the batch window and burst gap from the environment', async () => {
    process.env.EVENT_BATCH_WINDOW_MS = '1234'
    process.env.EVENT_BURST_GAP_MS = '99000'

    const { EventBatcher } = await import('./event-batcher')
    await import('./mqtt')

    expect(EventBatcher).toHaveBeenCalledWith(
      expect.any(Function),
      1234,
      99_000,
    )
  })

  it('keeps a valid knob when the other is invalid', async () => {
    process.env.EVENT_BATCH_WINDOW_MS = 'banana'
    process.env.EVENT_BURST_GAP_MS = '99000'

    const { EventBatcher } = await import('./event-batcher')
    await import('./mqtt')

    expect(EventBatcher).toHaveBeenCalledWith(
      expect.any(Function),
      30_000,
      99_000,
    )
  })
})

describe('Apple update throttle configuration', () => {
  it('uses the built-in default when nothing is set', async () => {
    const { SendThrottle } = await import('./send-throttle')
    await import('./push-notify')

    expect(SendThrottle).toHaveBeenCalledWith(300_000)
  })

  it('takes the interval from the environment', async () => {
    process.env.APPLE_UPDATE_INTERVAL_MS = '77000'

    const { SendThrottle } = await import('./send-throttle')
    await import('./push-notify')

    expect(SendThrottle).toHaveBeenCalledWith(77_000)
  })
})
