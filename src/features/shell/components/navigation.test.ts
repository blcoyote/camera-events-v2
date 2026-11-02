import { describe, it, expect } from 'vitest'
import { TABS, getActiveTab, getTitleBar } from './navigation'
import { withLocale } from '#/test-utils/locale'

describe('TABS', () => {
  it('lists the four primary destinations in order', () => {
    expect(TABS.map((t) => [t.label, t.to])).toEqual([
      ['Cameras', '/cameras'],
      ['Events', '/camera-events'],
      ['Favorites', '/favorites'],
      ['Settings', '/settings'],
    ])
  })
})

describe('getActiveTab', () => {
  it.each([
    ['/camera-events', '/camera-events'],
    ['/camera-events/abc', '/camera-events'],
    ['/cameras', '/cameras'],
    ['/live/front', '/cameras'],
    ['/favorites', '/favorites'],
    ['/settings', '/settings'],
    ['/', null],
    ['/other', null],
  ])('%s -> %s', (path, expected) => {
    expect(getActiveTab(path)).toBe(expected)
  })
})

describe('getActiveTab with origin', () => {
  it('attributes an event detail opened from favorites to Favorites', () => {
    expect(getActiveTab('/camera-events/abc', { from: 'favorites' })).toBe(
      '/favorites',
    )
  })
  it('keeps Events for an event detail opened from events', () => {
    expect(getActiveTab('/camera-events/abc', { from: 'events' })).toBe(
      '/camera-events',
    )
  })
  it('keeps Events for an event detail without search', () => {
    expect(getActiveTab('/camera-events/abc')).toBe('/camera-events')
  })
  it('ignores from=favorites on the list path', () => {
    expect(getActiveTab('/camera-events', { from: 'favorites' })).toBe(
      '/camera-events',
    )
  })
  it('ignores from=favorites on /cameras', () => {
    expect(getActiveTab('/cameras', { from: 'favorites' })).toBe('/cameras')
  })
})

describe('getTitleBar', () => {
  it('uses the last crumb as title and the previous linked crumb as back', () => {
    expect(
      getTitleBar([
        { label: 'Favorites', to: '/favorites' },
        { label: 'Person · Front Door' },
      ]),
    ).toEqual({
      title: 'Person · Front Door',
      back: { label: 'Favorites', to: '/favorites' },
    })
  })
  it('has no back for a single crumb', () => {
    expect(getTitleBar([{ label: 'Cameras' }])).toEqual({
      title: 'Cameras',
      back: null,
    })
  })
  it('has no back when the previous crumb has no link', () => {
    expect(getTitleBar([{ label: 'A' }, { label: 'B' }]).back).toBeNull()
  })
})

describe('Danish', () => {
  it('translates tab labels', () => {
    const restore = withLocale('da')
    try {
      expect(TABS.map((t) => t.label)).toEqual([
        'Kameraer',
        'Hændelser',
        'Favoritter',
        'Indstillinger',
      ])
    } finally {
      restore()
    }
  })
})
