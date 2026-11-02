import { describe, it, expect, afterEach } from 'vitest'
import {
  validateEventDetailSearch,
  eventDetailBreadcrumb,
} from '#/features/camera-details/utils/eventBreadcrumb'
import { withLocale } from '#/test-utils/locale'
import { m } from '#/paraglide/messages.js'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

function makeEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1.0-abc',
    label: 'person',
    sub_label: null,
    camera: 'front_door',
    start_time: 1,
    end_time: 2,
    false_positive: null,
    zones: [],
    thumbnail: '',
    has_clip: false,
    has_snapshot: false,
    retain_indefinitely: false,
    plus_id: null,
    box: null,
    top_score: null,
    data: {
      attributes: [],
      box: [0.5, 0.5, 0.1, 0.2],
      region: [0, 0, 1, 1],
      score: 0.85,
      top_score: 0.85,
      type: 'object',
    },
    ...overrides,
  }
}

const okData = (e: FrigateEvent = makeEvent()) => ({
  result: { ok: true, data: e },
})

const run = (search: Record<string, unknown>, loaderData: unknown) =>
  eventDetailBreadcrumb({ params: {}, search, loaderData })

describe('validateEventDetailSearch', () => {
  it.each(['events', 'favorites'] as const)('keeps from=%s', (from) => {
    expect(validateEventDetailSearch({ from }).from).toBe(from)
  })

  it.each(['settings', 'FAVORITES', 123, '', null])(
    'drops tampered from=%s',
    (from) => {
      expect(validateEventDetailSearch({ from }).from).toBeUndefined()
    },
  )

  it('passes filters through and validates them', () => {
    expect(
      validateEventDetailSearch({
        from: 'events',
        camera: 'front',
        type: 'car',
      }),
    ).toEqual({ from: 'events', camera: 'front', type: 'car' })
    expect(
      validateEventDetailSearch({ camera: 'x'.repeat(65), type: 5 }),
    ).toEqual({ from: undefined, camera: undefined, type: undefined })
  })
})

describe('eventDetailBreadcrumb parent', () => {
  it('links to favorites without search, ignoring filters', () => {
    const [parent] = run(
      { from: 'favorites', camera: 'a', type: 'b' },
      undefined,
    )
    expect(parent).toEqual({ label: m.shell_tab_favorites(), to: '/favorites' })
  })

  it.each([{ from: 'events' }, {}, { from: 'bogus' }])(
    'links to events without search when no filters (%j)',
    (search) => {
      const [parent] = run(search, undefined)
      expect(parent).toEqual({
        label: m.shell_tab_events(),
        to: '/camera-events',
      })
      expect('search' in parent).toBe(false)
    },
  )

  it('forwards valid filters to events parent', () => {
    const [parent] = run(
      { from: 'events', camera: 'front', type: 'car' },
      undefined,
    )
    expect(parent.to).toBe('/camera-events')
    expect(parent.search).toEqual({ camera: 'front', type: 'car' })
  })

  it('forwards only defined filters', () => {
    const [parent] = run({ type: 'car' }, undefined)
    expect(parent.search).toEqual({ type: 'car' })
  })

  it('does not forward invalid camera', () => {
    const [parent] = run({ camera: 'x'.repeat(65), type: 'car' }, undefined)
    expect(parent.search).toEqual({ type: 'car' })
    const [p2] = run({ camera: 'x'.repeat(65) }, undefined)
    expect('search' in p2).toBe(false)
  })
})

describe('eventDetailBreadcrumb current', () => {
  let restore: (() => void) | undefined
  afterEach(() => restore?.())

  it('labels with event label and camera', () => {
    const crumbs = run({}, okData())
    expect(crumbs).toHaveLength(2)
    expect(crumbs[1]).toEqual({ label: 'Person · Front Door' })
    expect('to' in crumbs[1]).toBe(false)
  })

  it('translates the label in Danish', () => {
    restore = withLocale('da')
    expect(run({}, okData())[1].label).toBe('Person · Front Door')
  })

  it('falls back to the generic title', () => {
    const generic = m.shell_title_event()
    expect(
      run({}, { result: { ok: false, error: 'x', status: 404 } })[1].label,
    ).toBe(generic)
    expect(run({}, undefined)[1].label).toBe(generic)
    expect(run({}, { result: 5 })[1].label).toBe(generic)
    expect(run({}, null)[1].label).toBe(generic)
  })
})
