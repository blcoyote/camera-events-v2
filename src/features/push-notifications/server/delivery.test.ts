import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDelivery } from './delivery'
import type { DeliveryDeps, DeliveryRequest } from './delivery'
import type { PushPayload, PushSubscriptionInfo } from './push'

interface FakeSub {
  endpoint: string
  p256dh: string
  auth: string
  locale?: string
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

  describe('ignoreMute', () => {
    it('sends while muted without consulting the mute check', async () => {
      const isMuted = vi.fn(() => Promise.resolve(true))
      const deps = makeDeps({ isMuted })
      await createDelivery(deps).deliver(makeRequest({ ignoreMute: true }))
      expect(isMuted).not.toHaveBeenCalled()
      expect(deps.send).toHaveBeenCalledTimes(1)
    })

    it('still suppresses while muted without it', async () => {
      const deps = makeDeps({ isMuted: () => Promise.resolve(true) })
      await createDelivery(deps).deliver(makeRequest())
      expect(deps.send).not.toHaveBeenCalled()
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

  describe('locale', () => {
    it('sends each subscription the payload for its locale, built once per locale', async () => {
      const send = vi.fn(() => Promise.resolve())
      const buildPayload = vi.fn(
        (burstStart: boolean, locale: string): PushPayload => ({
          ...makePayload(burstStart),
          body: `body-${locale}`,
        }),
      )
      const store = makeStore({
        u1: [
          { ...makeSub(1), locale: 'da' },
          { ...makeSub(2), locale: 'en' },
        ],
        u2: [
          { ...makeSub(3), locale: 'da' },
          { ...makeSub(4), locale: 'xx' },
          makeSub(5),
        ],
      })
      await createDelivery(
        makeDeps({ send, getStore: () => Promise.resolve(store) }),
      ).deliver(makeRequest({ buildPayload }))

      const bodies = send.mock.calls.map(
        (c) => (c as unknown as [unknown, PushPayload])[1].body,
      )
      expect(bodies).toEqual([
        'body-da',
        'body-en',
        'body-da',
        'body-en',
        'body-en',
      ])
      expect(buildPayload).toHaveBeenCalledTimes(2)
    })
  })

  describe('burstStart', () => {
    it('passes true for burst.start true', async () => {
      const buildPayload = vi.fn(makePayload)
      await createDelivery(makeDeps()).deliver(
        makeRequest({ burst: { key: 'k', start: true }, buildPayload }),
      )
      expect(buildPayload).toHaveBeenCalledWith(true, 'en')
    })

    it('passes false for burst.start false', async () => {
      const buildPayload = vi.fn(makePayload)
      await createDelivery(makeDeps()).deliver(
        makeRequest({ burst: { key: 'k', start: false }, buildPayload }),
      )
      expect(buildPayload).toHaveBeenCalledWith(false, 'en')
    })

    it('passes false when burst is omitted', async () => {
      const buildPayload = vi.fn(makePayload)
      await createDelivery(makeDeps()).deliver(makeRequest({ buildPayload }))
      expect(buildPayload).toHaveBeenCalledWith(false, 'en')
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
      expect(buildPayload).toHaveBeenLastCalledWith(true, 'en')
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
    })

    it('does not promote after a muted continuation', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'k', false)
      setMuted(false)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
    })

    it('clears the flag on a natural unmuted burst start', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'k', true)
      setMuted(false)
      await run(d, 'k', true)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
    })

    it('isolates keys', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await run(d, 'a', true)
      setMuted(false)
      await run(d, 'b', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
    })

    it('does not share state between instances', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      setMuted(true)
      await run(createDelivery(deps), 'k', true)
      setMuted(false)
      await run(createDelivery(deps), 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
    })

    it('a muted request without burst never touches swallowed state', async () => {
      const { deps, buildPayload, run, setMuted } = setup()
      const d = createDelivery(deps)
      setMuted(true)
      await d.deliver(makeRequest())
      setMuted(false)
      await run(d, 'k', false)
      expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
    })

    describe('flag is cleared only once the promoted Alert is settled', () => {
      /** Mute a burst start, then run one unmuted continuation with `second` overrides; returns buildPayload. */
      async function mutedStartThenUnmuted(second: Partial<DeliveryDeps>) {
        let muted = true
        let phase: 'first' | 'second' = 'first'
        const base = makeDeps({ isMuted: () => Promise.resolve(muted) })
        const deps: DeliveryDeps = {
          ...base,
          getStore: () =>
            phase === 'second' && second.getStore
              ? second.getStore()
              : base.getStore(),
          send: (sub, payload) =>
            phase === 'second' && second.send
              ? second.send(sub, payload)
              : base.send(sub, payload),
        }
        const buildPayload = vi.fn(makePayload)
        const d = createDelivery(deps)
        const run = (start: boolean, extra: Partial<DeliveryRequest> = {}) =>
          d.deliver(
            makeRequest({
              burst: { key: 'k', start },
              buildPayload,
              ...extra,
            }),
          )
        await run(true)
        muted = false
        phase = 'second'
        return { run, buildPayload }
      }

      it('keeps the flag when the store read throws, and propagates the error', async () => {
        const getStore = vi
          .fn()
          .mockRejectedValueOnce(new Error('db down'))
          .mockResolvedValue(makeStore({ u1: [makeSub(1)] }))
        const { run, buildPayload } = await mutedStartThenUnmuted({ getStore })
        await expect(run(false)).rejects.toThrow('db down')
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(true, 'en')
      })

      it('keeps the flag when every attempted send rejects', async () => {
        const send = vi.fn(() => Promise.reject(new Error('gone')))
        const { run, buildPayload } = await mutedStartThenUnmuted({ send })
        await run(false)
        expect(send).toHaveBeenCalled()
        expect(buildPayload).toHaveBeenLastCalledWith(true, 'en')
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(true, 'en')
      })

      it('clears the flag when at least one send succeeds', async () => {
        const store = makeStore({ u1: [makeSub(1), makeSub(2)] })
        const send = vi
          .fn()
          .mockRejectedValueOnce(new Error('gone'))
          .mockResolvedValue(undefined)
        const { run, buildPayload } = await mutedStartThenUnmuted({
          getStore: () => Promise.resolve(store),
          send,
        })
        await run(false)
        expect(send).toHaveBeenCalledTimes(2)
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
      })

      it('settles (clears) when the only send resolves expired', async () => {
        const send = vi.fn(() => Promise.resolve('expired'))
        const { run, buildPayload } = await mutedStartThenUnmuted({
          send: send as never,
        })
        await run(false)
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
      })

      it('keeps the flag when one send is expired and the other fails', async () => {
        const store = makeStore({ u1: [makeSub(1), makeSub(2)] })
        const send = vi
          .fn()
          .mockResolvedValueOnce('expired')
          .mockRejectedValueOnce(new Error('transient'))
        const { run, buildPayload } = await mutedStartThenUnmuted({
          getStore: () => Promise.resolve(store),
          send,
        })
        await run(false)
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(true, 'en')
      })

      it('clears the flag when one send is expired and the other is sent', async () => {
        const store = makeStore({ u1: [makeSub(1), makeSub(2)] })
        const send = vi
          .fn()
          .mockResolvedValueOnce('expired')
          .mockResolvedValueOnce('sent')
        const { run, buildPayload } = await mutedStartThenUnmuted({
          getStore: () => Promise.resolve(store),
          send,
        })
        await run(false)
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
      })

      it('counts a send resolving undefined as sent', async () => {
        const send = vi.fn(() => Promise.resolve(undefined))
        const { run, buildPayload } = await mutedStartThenUnmuted({ send })
        await run(false)
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
      })

      it('clears the flag when nobody is eligible', async () => {
        const { run, buildPayload } = await mutedStartThenUnmuted({})
        await run(false, { isUserEligible: () => false })
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
      })

      it('clears the flag when every endpoint is skipped by allowEndpoint', async () => {
        const { run, buildPayload } = await mutedStartThenUnmuted({})
        await run(false, { allowEndpoint: () => false })
        await run(false)
        expect(buildPayload).toHaveBeenLastCalledWith(false, 'en')
      })
    })
  })

  describe('serialization per burst key', () => {
    const tick = () => new Promise((r) => setTimeout(r, 0))

    /** A `send` whose calls stay pending until the test settles them. */
    function heldSend() {
      const calls: Array<{
        payload: PushPayload
        resolve: (v?: 'sent' | 'expired') => void
        reject: (e: Error) => void
      }> = []
      const send = vi.fn(
        (_sub: PushSubscriptionInfo, payload: PushPayload) =>
          new Promise<void>((resolve, reject) => {
            calls.push({ payload, resolve: resolve as never, reject })
          }),
      )
      return { send, calls }
    }

    function setup() {
      let muted = false
      const held = heldSend()
      const deps = makeDeps({
        isMuted: () => Promise.resolve(muted),
        send: held.send,
      })
      const d = createDelivery(deps)
      const run = (key: string | null, start: boolean) =>
        d.deliver(
          makeRequest(
            key === null
              ? { buildPayload: makePayload }
              : { burst: { key, start }, buildPayload: makePayload },
          ),
        )
      return {
        d,
        run,
        held,
        mute: async (key: string) => {
          muted = true
          await run(key, true)
          muted = false
        },
      }
    }

    it('promotes only the first of two overlapping unmuted deliveries', async () => {
      const { run, held, mute } = setup()
      await mute('k')
      const first = run('k', false)
      const second = run('k', false)
      await tick()
      expect(held.calls).toHaveLength(1)
      expect(held.calls[0].payload.event?.burstStart).toBe(true)
      held.calls[0].resolve()
      await first
      await tick()
      expect(held.calls).toHaveLength(2)
      expect(held.calls[1].payload.event?.burstStart).toBe(false)
      held.calls[1].resolve()
      await second
    })

    it('promotes the second delivery when the first fails entirely', async () => {
      const { run, held, mute } = setup()
      await mute('k')
      const first = run('k', false)
      const second = run('k', false)
      await tick()
      held.calls[0].reject(new Error('down'))
      await first
      await tick()
      expect(held.calls[1].payload.event?.burstStart).toBe(true)
      held.calls[1].resolve()
      await second
    })

    it('does not serialize different keys', async () => {
      const { run, held } = setup()
      const a = run('a', true)
      const b = run('b', true)
      await tick()
      expect(held.calls).toHaveLength(2)
      held.calls.forEach((c) => c.resolve())
      await Promise.all([a, b])
    })

    it('does not serialize requests without burst', async () => {
      const { run, held } = setup()
      const a = run(null, false)
      const b = run(null, false)
      await tick()
      expect(held.calls).toHaveLength(2)
      held.calls.forEach((c) => c.resolve())
      await Promise.all([a, b])
    })

    it('a rejection reaches its caller without wedging the next call', async () => {
      const held = heldSend()
      const getStore = vi
        .fn()
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValue(makeStore({ u1: [makeSub(1)] }))
      const d = createDelivery(makeDeps({ getStore, send: held.send }))
      const run = () =>
        d.deliver(makeRequest({ burst: { key: 'k', start: false } }))
      const first = run()
      const second = run()
      await expect(first).rejects.toThrow('db down')
      await tick()
      expect(held.calls).toHaveLength(1)
      held.calls[0].resolve()
      await expect(second).resolves.toBeUndefined()
    })
  })
})
