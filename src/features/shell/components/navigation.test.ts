import { describe, it, expect } from 'vitest'
import { TABS, getActiveTab, getPageTitle } from './navigation'

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

describe('getPageTitle', () => {
  it.each([
    ['/cameras', 'Cameras'],
    ['/camera-events', 'Events'],
    ['/camera-events/abc', 'Event'],
    ['/favorites', 'Favorites'],
    ['/settings', 'Settings'],
    ['/live/front', 'Live view'],
    ['/', 'Camera Events'],
    ['/other', 'Camera Events'],
  ])('%s -> %s', (path, expected) => {
    expect(getPageTitle(path)).toBe(expected)
  })
})
