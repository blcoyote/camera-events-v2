import { describe, it, expect } from 'vitest'
import { isAppleEndpoint, SendThrottle } from './send-throttle'

describe('isAppleEndpoint', () => {
  it('returns true for an Apple Web Push endpoint', () => {
    expect(
      isAppleEndpoint('https://web.push.apple.com/QRs7-abc123DEF456'),
    ).toBe(true)
  })

  it('returns false for a Google FCM endpoint', () => {
    expect(isAppleEndpoint('https://fcm.googleapis.com/fcm/send/abc123')).toBe(
      false,
    )
  })

  it('returns false for a Mozilla autopush endpoint', () => {
    expect(
      isAppleEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'),
    ).toBe(false)
  })

  it('returns false for a host that merely suffixes the Apple host', () => {
    expect(isAppleEndpoint('https://web.push.apple.com.evil.example/abc')).toBe(
      false,
    )
  })

  it('returns false for a malformed endpoint', () => {
    expect(isAppleEndpoint('not-a-url')).toBe(false)
  })

  it('returns false for an empty endpoint', () => {
    expect(isAppleEndpoint('')).toBe(false)
  })
})

describe('SendThrottle', () => {
  const FIVE_MIN = 300_000

  it('allows the first send for a key', () => {
    const throttle = new SendThrottle(FIVE_MIN)

    expect(throttle.tryAcquire('front_porch|apple', 0)).toBe(true)
  })

  it('blocks a second send inside the interval', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.tryAcquire('front_porch|apple', 0)

    expect(throttle.tryAcquire('front_porch|apple', 30_000)).toBe(false)
  })

  it('blocks right up to the interval boundary', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.tryAcquire('front_porch|apple', 0)

    expect(throttle.tryAcquire('front_porch|apple', FIVE_MIN - 1)).toBe(false)
  })

  it('allows again once the interval has elapsed', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.tryAcquire('front_porch|apple', 0)

    expect(throttle.tryAcquire('front_porch|apple', FIVE_MIN)).toBe(true)
  })

  it('paces repeated sends to one per interval', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    const allowed: number[] = []

    // An event every 30 s for 12 minutes
    for (let t = 0; t <= 720_000; t += 30_000) {
      if (throttle.tryAcquire('front_porch|apple', t)) allowed.push(t)
    }

    expect(allowed).toEqual([0, FIVE_MIN, 600_000])
  })

  it('tracks keys independently', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.tryAcquire('front_porch|apple', 0)

    expect(throttle.tryAcquire('driveway|apple', 0)).toBe(true)
    expect(throttle.tryAcquire('front_porch|other-device', 0)).toBe(true)
  })

  it('does not record a send when the attempt is blocked', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.tryAcquire('front_porch|apple', 0)
    throttle.tryAcquire('front_porch|apple', 299_000) // blocked

    // The blocked attempt must not push the window out to 299_000 + FIVE_MIN
    expect(throttle.tryAcquire('front_porch|apple', FIVE_MIN)).toBe(true)
  })

  it('record() blocks a later attempt inside the interval', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.record('front_porch|apple', 0)

    expect(throttle.tryAcquire('front_porch|apple', 30_000)).toBe(false)
  })

  it('record() resets the interval for an already-tracked key', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.tryAcquire('front_porch|apple', 0)
    throttle.record('front_porch|apple', 200_000)

    expect(throttle.tryAcquire('front_porch|apple', FIVE_MIN)).toBe(false)
    expect(throttle.tryAcquire('front_porch|apple', 500_000)).toBe(true)
  })

  it('drops keys that can no longer block anything', () => {
    const throttle = new SendThrottle(FIVE_MIN)
    throttle.record('stale|apple', 0)
    throttle.record('fresh|apple', FIVE_MIN)

    // 'stale' is older than the interval, so it is behaviourally dead — the
    // map must not keep growing for endpoints that have gone away.
    expect(throttle.size()).toBe(1)
  })
})
