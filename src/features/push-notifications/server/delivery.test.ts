import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDelivery } from './delivery'
import type { DeliveryDeps, DeliveryRequest } from './delivery'
import type { PushPayload, PushSubscriptionInfo } from './push'

interface FakeSub {
  endpoint: string
  p256dh: string
  auth: string
}

function makeStore(users: Record<string, FakeSub[]>) {
  return {
    getAllSubscribedUserIds: vi.fn(() => Object.keys(users)),
    getSubscriptionsByUserId: vi.fn((id: string) => users[id] ?? []),
    isCameraEnabledForUser: vi.fn(() => true),
    isCameraAvailabilityEnabledForUser: vi.fn(() => true),
  }
}

function makeSub(n: number): FakeSub {
  return {
    endpoint: `https://push.example/${n}`,
    p256dh: `p${n}`,
    auth: `a${n}`,
  }
}

function makePayload(burstStart = false): PushPayload {
  return {
    title: 'T',
    body: 'B',
    url: '/x',
    icon: '/i.png',
    tag: 'tag',
    event: {
      camera: 'c',
      count: 1,
      labels: ['Person'],
      timestamp: 1,
      burstStart,
    },
  }
}

function makeDeps(overrides: Partial<DeliveryDeps> = {}): DeliveryDeps {
  return {
    isPushEnabled: () => true,
    isMuted: () => Promise.resolve(false),
    getStore: () => Promise.resolve(makeStore({ u1: [makeSub(1)] })),
    send: vi.fn(() => Promise.resolve()),
    now: () => 1000,
    ...overrides,
  }
}

function makeRequest(
  overrides: Partial<DeliveryRequest> = {},
): DeliveryRequest {
  return {
    logTag: 'test-tag',
    description: 'Camera "x": 3 event(s)',
    isUserEligible: () => true,
    buildPayload: (burstStart) => makePayload(burstStart),
    ...overrides,
  }
}

describe('createDelivery', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  describe('guards', () => {
    it('does nothing when push is disabled', async () => {
      const getStore = vi.fn(() => Promise.resolve(makeStore({})))
      const deps = makeDeps({ isPushEnabled: () => false, getStore })
      await createDelivery(deps).deliver(makeRequest())
      expect(deps.send).not.toHaveBeenCalled()
      expect(getStore).not.toHaveBeenCalled()
    })

    it('suppresses and logs when muted, using deps.now()', async () => {
      const isMuted = vi.fn(() => Promise.resolve(true))
      const getStore = vi.fn(() => Promise.resolve(makeStore({})))
      const deps = makeDeps({ isMuted, getStore, now: () => 4242 })
      await createDelivery(deps).deliver(makeRequest())
      expect(isMuted).toHaveBeenCalledWith(4242)
      expect(deps.send).not.toHaveBeenCalled()
      expect(getStore).not.toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalledWith(
        '[test-tag] Camera "x": 3 event(s) suppressed — notifications are globally muted',
      )
    })
  })

  describe('fan-out', () => {
    it('sends once per subscription across users', async () => {
      const store = makeStore({
        u1: [makeSub(1), makeSub(2)],
        u2: [makeSub(3)],
      })
      const deps = makeDeps({ getStore: () => Promise.resolve(store) })
      await createDelivery(deps).deliver(makeRequest())
      const send = deps.send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledTimes(3)
      const expected: PushSubscriptionInfo = {
        endpoint: 'https://push.example/3',
        keys: { p256dh: 'p3', auth: 'a3' },
      }
      expect(send).toHaveBeenCalledWith(expected, makePayload(false))
    })

    it('skips ineligible users', async () => {
      const store = makeStore({ u1: [makeSub(1)], u2: [makeSub(2)] })
      const deps = makeDeps({ getStore: () => Promise.resolve(store) })
      await createDelivery(deps).deliver(
        makeRequest({ isUserEligible: (id) => id !== 'u1' }),
      )
      const send = deps.send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0][0].endpoint).toBe('https://push.example/2')
    })

    it('does not throw or send with no subscribed users', async () => {
      const deps = makeDeps({
        getStore: () => Promise.resolve(makeStore({})),
      })
      await expect(
        createDelivery(deps).deliver(makeRequest()),
      ).resolves.toBeUndefined()
      expect(deps.send).not.toHaveBeenCalled()
    })

    it('continues after a failing send and logs it', async () => {
      const store = makeStore({ u1: [makeSub(1), makeSub(2)] })
      const send = vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(undefined)
      const deps = makeDeps({ getStore: () => Promise.resolve(store), send })
      await createDelivery(deps).deliver(makeRequest())
      expect(send).toHaveBeenCalledTimes(2)
      expect(errorSpy).toHaveBeenCalledWith(
        '[test-tag] Failed to send to https://push.example/1:',
        'boom',
      )
    })
  })

  describe('allowEndpoint', () => {
    it('skips denied endpoints and reports them', async () => {
      const store = makeStore({ u1: [makeSub(1), makeSub(2)] })
      const deps = makeDeps({ getStore: () => Promise.resolve(store) })
      const onEndpointSkipped = vi.fn()
      await createDelivery(deps).deliver(
        makeRequest({
          allowEndpoint: (e) => e !== 'https://push.example/1',
          onEndpointSkipped,
        }),
      )
      const send = deps.send as ReturnType<typeof vi.fn>
      expect(send).toHaveBeenCalledTimes(1)
      expect(onEndpointSkipped).toHaveBeenCalledWith('https://push.example/1')
    })

    it('passes effective burstStart and now', async () => {
      const allowEndpoint = vi.fn(() => true)
      const deps = makeDeps({ now: () => 777 })
      await createDelivery(deps).deliver(
        makeRequest({ burst: { key: 'k', start: true }, allowEndpoint }),
      )
      expect(allowEndpoint).toHaveBeenCalledWith(
        'https://push.example/1',
        true,
        777,
      )
    })
  })

  describe('burstStart', () => {
    it('passes true for burst.start true', async () => {
      const buildPayload = vi.fn(makePayload)
      await createDelivery(makeDeps()).deliver(
        makeRequest({ burst: { key: 'k', start: true }, buildPayload }),
      )
      expect(buildPayload).toHaveBeenCalledWith(true)
    })

    it('passes false for burst.start false', async () => {
      const buildPayload = vi.fn(makePayload)
      await createDelivery(makeDeps()).deliver(
        makeRequest({ burst: { key: 'k', start: false }, buildPayload }),
      )
      expect(buildPayload).toHaveBeenCalledWith(false)
    })

    it('passes false when burst is omitted', async () => {
      const buildPayload = vi.fn(makePayload)
      await createDelivery(makeDeps()).deliver(makeRequest({ buildPayload }))
      expect(buildPayload).toHaveBeenCalledWith(false)
    })
  })

  describe('swallowed alert promotion', () => {
    function setup() {
      let muted = false
      const deps = makeDeps({ isMuted: () => Promise.resolve(muted) })
      const buildPayload = vi.fn(makePayload)
      const run = (
        d: ReturnType<typeof createDelivery>,
        key: string,
        start: boolean,
      ) => d.deliver(makeRequest({ burst: { key, start }, buildPayload }))
      return {
        deps,
        buildPayload,
        run,
        setMuted: (m: boolean) => {
          muted = m
        },
      }
    }

    it('promotes the first unmuted flush after a muted burst start, then clears', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'k', true)
      setMuted(false)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(true)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false)
    })

    it('does not promote after a muted continuation', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'k', false)
      setMuted(false)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false)
    })

    it('clears the flag on a natural unmuted burst start', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'k', true)
      setMuted(false)
      await run(d, 'k', true)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false)
    })

    it('isolates keys', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'a', true)
      setMuted(false)
      await run(d, 'b', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false)
    })

    it('does not share state between instances', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      setMuted(true)
      await run(createDelivery(deps), 'k', true)
      setMuted(false)
      await run(createDelivery(deps), 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false)
    })

    it('a muted request without burst never touches swallowed state', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await d.deliver(makeRequest())
      setMuted(false)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false)
    })
  })
})
