import { describe, it, expect } from 'vitest'
import {
  parsePushPayload,
  buildNotificationOptions,
  readNotificationState,
  planNotification,
  readExistingState,
  resolveNotificationTag,
  getNotificationClickUrl,
  setPendingNavigationUrl,
  popPendingNavigationUrl,
} from './sw-push-handlers'

function createMockCacheStorage(): CacheStorage {
  const stores = new Map<string, Map<string, Response>>()
  return {
    open: async (name: string) => {
      let store = stores.get(name)
      if (!store) {
        store = new Map()
        stores.set(name, store)
      }
      const s = store
      return {
        put: async (key: string, response: Response) => {
          s.set(key, response)
        },
        match: async (key: string) => s.get(key),
        delete: async (key: string) => s.delete(key),
      } as unknown as Cache
    },
  } as unknown as CacheStorage
}

describe('parsePushPayload', () => {
  it('parses a valid payload', () => {
    const result = parsePushPayload({
      title: 'Test',
      body: 'Hello world',
      url: '/camera-events/123',
    })
    expect(result).toMatchObject({
      title: 'Test',
      body: 'Hello world',
      url: '/camera-events/123',
    })
  })

  it('re-formats a single-event body using the device timezone', () => {
    // 1713182400 = 2024-04-15T12:00:00Z
    const result = parsePushPayload({
      title: 'Front Porch',
      body: 'Person detected at 12:00',
      url: '/camera-events/abc',
      event: {
        camera: 'front_porch',
        count: 1,
        labels: ['Person'],
        timestamp: 1713182400,
        burstStart: true,
      },
    })
    const localTime = new Date(1713182400 * 1000).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(result.body).toBe(`Person detected at ${localTime}`)
    expect(result.event).toEqual({
      camera: 'front_porch',
      count: 1,
      labels: ['Person'],
      timestamp: 1713182400,
      burstStart: true,
    })
  })

  it('re-formats a multi-event body with count and labels', () => {
    const result = parsePushPayload({
      title: 'Driveway',
      body: 'server fallback',
      url: '/camera-events',
      event: {
        camera: 'driveway',
        count: 3,
        labels: ['Person', 'Car', 'Dog'],
        timestamp: 1713182400,
        burstStart: true,
      },
    })
    const localTime = new Date(1713182400 * 1000).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
    expect(result.body).toBe(`3 new events — Person, Car, Dog at ${localTime}`)
  })

  it('truncates label lists beyond three with +N more', () => {
    const result = parsePushPayload({
      title: 'Driveway',
      body: 'server fallback',
      url: '/camera-events',
      event: {
        camera: 'driveway',
        count: 5,
        labels: ['Person', 'Car', 'Dog', 'Cat', 'Bird'],
        timestamp: 1713182400,
        burstStart: true,
      },
    })
    expect(result.body).toContain('Person, Car, Dog +2 more')
  })

  it('defaults burstStart to true when the flag is absent', () => {
    // An absent flag must not silently downgrade an alert into a silent patch.
    const result = parsePushPayload({
      title: 'Front Porch',
      body: 'server fallback',
      url: '/camera-events',
      event: {
        camera: 'front_porch',
        count: 1,
        labels: ['Person'],
        timestamp: 1713182400,
      },
    })
    expect(result.event?.burstStart).toBe(true)
  })

  it('falls back to the raw body when the event is missing its camera', () => {
    const result = parsePushPayload({
      title: 'T',
      body: 'raw body text',
      url: '/',
      event: { count: 1, labels: ['Person'], timestamp: 1713182400 },
    })
    expect(result.body).toBe('raw body text')
    expect(result.event).toBeUndefined()
  })

  it('falls back to the raw body when labels is not an array of strings', () => {
    const result = parsePushPayload({
      title: 'T',
      body: 'raw body text',
      url: '/',
      event: {
        camera: 'front_porch',
        count: 1,
        labels: [{ evil: true }],
        timestamp: 1713182400,
      },
    })
    expect(result.body).toBe('raw body text')
    expect(result.event).toBeUndefined()
  })

  it('parses the per-camera tag', () => {
    const result = parsePushPayload({
      title: 'Front Porch',
      body: 'b',
      url: '/',
      tag: 'camera-front_porch',
    })
    expect(result.tag).toBe('camera-front_porch')
  })

  it('parses icon when provided', () => {
    const result = parsePushPayload({
      title: 'Test',
      body: 'body',
      url: '/',
      icon: '/icon-192.png',
    })
    expect(result.icon).toBe('/icon-192.png')
  })

  it('returns undefined icon when not provided', () => {
    const result = parsePushPayload({ title: 'Test', body: '', url: '/' })
    expect(result.icon).toBeUndefined()
  })

  it('returns defaults for null data', () => {
    const result = parsePushPayload(null)
    expect(result).toMatchObject({ title: 'Notification', body: '', url: '/' })
  })

  it('returns defaults for undefined data', () => {
    const result = parsePushPayload(undefined)
    expect(result).toMatchObject({ title: 'Notification', body: '', url: '/' })
  })

  it('returns defaults for non-object data', () => {
    const result = parsePushPayload('not an object')
    expect(result).toMatchObject({ title: 'Notification', body: '', url: '/' })
  })

  it('falls back individual fields to defaults when missing', () => {
    const result = parsePushPayload({ title: 'Only Title' })
    expect(result).toMatchObject({ title: 'Only Title', body: '', url: '/' })
  })

  it('falls back title to default when empty string', () => {
    const result = parsePushPayload({
      title: '',
      body: 'content',
      url: '/page',
    })
    expect(result.title).toBe('Notification')
  })

  it('falls back url to default when empty string', () => {
    const result = parsePushPayload({ title: 'T', body: 'B', url: '' })
    expect(result.url).toBe('/')
  })
})

describe('buildNotificationOptions', () => {
  function makePlan(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Test',
      body: 'Hello',
      url: '/events/42',
      tag: 'camera-front_porch',
      silent: false,
      state: null,
      ...overrides,
    } as Parameters<typeof buildNotificationOptions>[0]
  }

  it('alerts and carries the click URL for a fresh notification', () => {
    const result = buildNotificationOptions(makePlan())

    expect(result).toEqual({
      body: 'Hello',
      icon: '/icon-192.png',
      tag: 'camera-front_porch',
      renotify: true,
      silent: false,
      data: { url: '/events/42', state: null },
    })
  })

  it('suppresses the re-alert for a patched notification', () => {
    const state = {
      camera: 'front_porch',
      count: 3,
      labels: ['Person'],
      timestamp: 1713182400,
      url: '/camera-events',
    }

    const result = buildNotificationOptions(makePlan({ silent: true, state }))

    expect(result.silent).toBe(true)
    expect(result.renotify).toBe(false)
  })

  it('stashes the accumulated state so the next push can merge onto it', () => {
    const state = {
      camera: 'front_porch',
      count: 3,
      labels: ['Person', 'Car'],
      timestamp: 1713182400,
      url: '/camera-events',
    }

    const result = buildNotificationOptions(makePlan({ silent: true, state }))

    expect(result.data).toEqual({ url: '/events/42', state })
  })

  it('uses custom icon when provided', () => {
    const result = buildNotificationOptions(
      makePlan({ icon: '/custom-icon.png' }),
    )

    expect(result.icon).toBe('/custom-icon.png')
  })

  it('falls back to default icon when icon is undefined', () => {
    const result = buildNotificationOptions(makePlan({ icon: undefined }))

    expect(result.icon).toBe('/icon-192.png')
  })
})

describe('readNotificationState', () => {
  const state = {
    camera: 'front_porch',
    count: 2,
    labels: ['Person'],
    timestamp: 1713182400,
    url: '/camera-events',
  }

  it('reads accumulated state written by a previous push', () => {
    expect(readNotificationState({ url: '/camera-events', state })).toEqual(
      state,
    )
  })

  it('returns null when the notification carries no state', () => {
    expect(readNotificationState({ url: '/camera-events' })).toBeNull()
  })

  it('returns null for null or non-object data', () => {
    expect(readNotificationState(null)).toBeNull()
    expect(readNotificationState('nope')).toBeNull()
  })

  it('returns null when the state is malformed', () => {
    expect(
      readNotificationState({ state: { ...state, count: 'two' } }),
    ).toBeNull()
    expect(
      readNotificationState({ state: { ...state, labels: 'Person' } }),
    ).toBeNull()
    expect(
      readNotificationState({ state: { ...state, camera: undefined } }),
    ).toBeNull()
  })
})

describe('planNotification', () => {
  function makePayload(
    event: Partial<{
      camera: string
      count: number
      labels: string[]
      timestamp: number
      burstStart: boolean
    }> = {},
  ) {
    return parsePushPayload({
      title: 'Front Porch',
      body: 'server fallback',
      url: '/camera-events/evt-1',
      icon: '/icon-192.png',
      tag: 'camera-front_porch',
      event: {
        camera: 'front_porch',
        count: 1,
        labels: ['Person'],
        timestamp: 1713182400,
        burstStart: true,
        ...event,
      },
    })
  }

  describe('a burst start', () => {
    it('alerts the user', () => {
      const plan = planNotification(makePayload(), null)

      expect(plan.silent).toBe(false)
    })

    it('keeps the deep link to a lone event', () => {
      const plan = planNotification(makePayload(), null)

      expect(plan.url).toBe('/camera-events/evt-1')
      expect(plan.title).toBe('Front Porch')
      expect(plan.tag).toBe('camera-front_porch')
    })

    it('resets the count even when a stale notification is still on screen', () => {
      const stale = {
        camera: 'front_porch',
        count: 9,
        labels: ['Car'],
        timestamp: 1713100000,
        url: '/camera-events',
      }

      const plan = planNotification(makePayload({ burstStart: true }), stale)

      expect(plan.state?.count).toBe(1)
      expect(plan.state?.labels).toEqual(['Person'])
      expect(plan.silent).toBe(false)
    })
  })

  describe('a continuation while the notification is still on screen', () => {
    const onScreen = {
      camera: 'front_porch',
      count: 1,
      labels: ['Person'],
      timestamp: 1713182400,
      url: '/camera-events/evt-1',
    }

    it('patches it silently instead of re-alerting', () => {
      const plan = planNotification(
        makePayload({ burstStart: false, count: 2, timestamp: 1713182500 }),
        onScreen,
      )

      expect(plan.silent).toBe(true)
    })

    it('accumulates the running total', () => {
      const plan = planNotification(
        makePayload({ burstStart: false, count: 2, timestamp: 1713182500 }),
        onScreen,
      )

      expect(plan.state?.count).toBe(3)
      expect(plan.body).toContain('3 new events')
    })

    it('unions labels without duplicating them', () => {
      const plan = planNotification(
        makePayload({
          burstStart: false,
          count: 2,
          labels: ['Person', 'Car'],
        }),
        onScreen,
      )

      expect(plan.state?.labels).toEqual(['Person', 'Car'])
    })

    it('advances to the newest timestamp', () => {
      const plan = planNotification(
        makePayload({ burstStart: false, timestamp: 1713182500 }),
        onScreen,
      )

      expect(plan.state?.timestamp).toBe(1713182500)
    })

    it('keeps the newest timestamp when a push arrives out of order', () => {
      const plan = planNotification(
        makePayload({ burstStart: false, timestamp: 1713100000 }),
        onScreen,
      )

      expect(plan.state?.timestamp).toBe(1713182400)
    })

    it('redirects the merged notification to the events list', () => {
      const plan = planNotification(
        makePayload({ burstStart: false }),
        onScreen,
      )

      // The single-event deep link no longer represents what was merged.
      expect(plan.url).toBe('/camera-events')
      expect(plan.state?.url).toBe('/camera-events')
    })

    it('ignores state belonging to a different camera', () => {
      const otherCamera = { ...onScreen, camera: 'driveway', count: 5 }

      const plan = planNotification(
        makePayload({ burstStart: false }),
        otherCamera,
      )

      expect(plan.state?.count).toBe(1)
    })
  })

  describe('a continuation after the notification is opened or dismissed', () => {
    it('alerts again with a fresh count', () => {
      const plan = planNotification(
        makePayload({ burstStart: false, count: 2 }),
        null,
      )

      expect(plan.silent).toBe(false)
      expect(plan.state?.count).toBe(2)
    })
  })

  describe('a payload with no structured event', () => {
    it('alerts and carries no mergeable state', () => {
      const payload = parsePushPayload({
        title: 'Test Notification',
        body: 'Push notifications are working!',
        url: '/',
        tag: 'push-test',
      })

      const plan = planNotification(payload, null)

      expect(plan.silent).toBe(false)
      expect(plan.body).toBe('Push notifications are working!')
      expect(plan.tag).toBe('push-test')
      expect(plan.state).toBeNull()
    })

    it('falls back to the shared tag when none is given', () => {
      const payload = parsePushPayload({ title: 'T', body: 'b', url: '/' })

      expect(planNotification(payload, null).tag).toBe('camera-event')
    })
  })
})

describe('resolveNotificationTag', () => {
  it('uses the tag the payload carries', () => {
    const payload = parsePushPayload({
      title: 'Front Porch',
      body: 'b',
      url: '/',
      tag: 'camera-front_porch',
    })

    expect(resolveNotificationTag(payload)).toBe('camera-front_porch')
  })

  it('falls back to the shared tag when the payload carries none', () => {
    const payload = parsePushPayload({ title: 'T', body: 'b', url: '/' })

    expect(resolveNotificationTag(payload)).toBe('camera-event')
  })
})

describe('readExistingState', () => {
  const state = {
    camera: 'front_porch',
    count: 2,
    labels: ['Person'],
    timestamp: 1713182400,
    url: '/camera-events',
  }

  /** Pass `null` to build a payload that carries no tag at all. */
  function makePayload(tag: string | null = 'camera-front_porch') {
    return parsePushPayload({
      title: 'Front Porch',
      body: 'server fallback',
      url: '/camera-events',
      ...(tag === null ? {} : { tag }),
    })
  }

  function makeRegistration(
    result: unknown[] | (() => never),
  ): Parameters<typeof readExistingState>[0] {
    return {
      getNotifications: async (filter: { tag: string }) => {
        if (typeof result === 'function') result()
        void filter
        return result as Array<{ data: unknown }>
      },
    }
  }

  it('returns the state of the notification still on screen', async () => {
    const registration = makeRegistration([
      { data: { url: '/camera-events', state } },
    ])

    await expect(
      readExistingState(registration, makePayload()),
    ).resolves.toEqual(state)
  })

  it("queries the payload's own tag", async () => {
    const seen: string[] = []
    const registration = {
      getNotifications: async (filter: { tag: string }) => {
        seen.push(filter.tag)
        return []
      },
    }

    await readExistingState(registration, makePayload('camera-driveway'))

    expect(seen).toEqual(['camera-driveway'])
  })

  it('looks up exactly the tag the notification will be shown under', async () => {
    // Guards against the lookup tag and the display tag drifting apart, which
    // would silently stop merging for payloads that carry no tag.
    const payload = makePayload(null)
    const seen: string[] = []
    const registration = {
      getNotifications: async (filter: { tag: string }) => {
        seen.push(filter.tag)
        return []
      },
    }

    await readExistingState(registration, payload)

    expect(seen).toEqual([planNotification(payload, null).tag])
  })

  it('returns null when nothing is on screen', async () => {
    await expect(
      readExistingState(makeRegistration([]), makePayload()),
    ).resolves.toBeNull()
  })

  it('skips notifications that carry no mergeable state', async () => {
    const registration = makeRegistration([
      { data: { url: '/camera-events' } },
      { data: { url: '/camera-events', state } },
    ])

    await expect(
      readExistingState(registration, makePayload()),
    ).resolves.toEqual(state)
  })

  it('returns null when getNotifications is unsupported', async () => {
    // Older Safari builds expose no getNotifications at all.
    await expect(readExistingState({}, makePayload())).resolves.toBeNull()
  })

  it('returns null when getNotifications throws', async () => {
    const registration = makeRegistration(() => {
      throw new Error('not implemented')
    })

    await expect(
      readExistingState(registration, makePayload()),
    ).resolves.toBeNull()
  })
})

describe('notification state round trip', () => {
  it('reads back the state that buildNotificationOptions wrote', () => {
    const payload = parsePushPayload({
      title: 'Front Porch',
      body: 'server fallback',
      url: '/camera-events/evt-1',
      tag: 'camera-front_porch',
      event: {
        camera: 'front_porch',
        count: 2,
        labels: ['Person', 'Car'],
        timestamp: 1713182400,
        burstStart: true,
      },
    })

    const options = buildNotificationOptions(planNotification(payload, null))

    // Guards the contract between the two halves of the merge: if the shape
    // written ever drifts from the shape read, merging silently stops working.
    expect(readNotificationState(options.data)).toEqual({
      camera: 'front_porch',
      count: 2,
      labels: ['Person', 'Car'],
      timestamp: 1713182400,
      url: '/camera-events/evt-1',
    })
  })
})

describe('getNotificationClickUrl', () => {
  it('extracts url from notification data', () => {
    const result = getNotificationClickUrl({ url: '/camera-events/123' })
    expect(result).toBe('/camera-events/123')
  })

  it('returns "/" when data is null', () => {
    expect(getNotificationClickUrl(null)).toBe('/')
  })

  it('returns "/" when data is undefined', () => {
    expect(getNotificationClickUrl(undefined)).toBe('/')
  })

  it('returns "/" when data has no url property', () => {
    expect(getNotificationClickUrl({ other: 'value' })).toBe('/')
  })

  it('returns "/" when url is not a string', () => {
    expect(getNotificationClickUrl({ url: 42 })).toBe('/')
  })

  it('rejects absolute URLs (open redirect)', () => {
    expect(getNotificationClickUrl({ url: 'https://attacker.com' })).toBe('/')
  })

  it('rejects protocol-relative URLs', () => {
    expect(getNotificationClickUrl({ url: '//evil.com/path' })).toBe('/')
  })

  it('rejects backslash-based URLs', () => {
    expect(getNotificationClickUrl({ url: '/\\evil.com' })).toBe('/')
  })

  it('allows valid relative paths', () => {
    expect(getNotificationClickUrl({ url: '/events/42' })).toBe('/events/42')
    expect(getNotificationClickUrl({ url: '/' })).toBe('/')
  })
})

describe('pending navigation storage', () => {
  it('returns null when nothing has been queued', async () => {
    const caches = createMockCacheStorage()
    expect(await popPendingNavigationUrl(caches)).toBeNull()
  })

  it('round-trips a URL and clears it after pop', async () => {
    const caches = createMockCacheStorage()
    await setPendingNavigationUrl(caches, '/camera-events/abc')
    expect(await popPendingNavigationUrl(caches)).toBe('/camera-events/abc')
    expect(await popPendingNavigationUrl(caches)).toBeNull()
  })

  it('overwrites a previously queued URL', async () => {
    const caches = createMockCacheStorage()
    await setPendingNavigationUrl(caches, '/camera-events/abc')
    await setPendingNavigationUrl(caches, '/camera-events/xyz')
    expect(await popPendingNavigationUrl(caches)).toBe('/camera-events/xyz')
  })

  it('rejects a queued URL that fails the open-redirect guard', async () => {
    const caches = createMockCacheStorage()
    const cache = await caches.open('camera-events-pending-nav-v1')
    await cache.put('/__pending-nav', new Response('https://attacker.com'))
    expect(await popPendingNavigationUrl(caches)).toBeNull()
  })

  it('rejects a queued protocol-relative URL', async () => {
    const caches = createMockCacheStorage()
    const cache = await caches.open('camera-events-pending-nav-v1')
    await cache.put('/__pending-nav', new Response('//evil.com'))
    expect(await popPendingNavigationUrl(caches)).toBeNull()
  })
})
