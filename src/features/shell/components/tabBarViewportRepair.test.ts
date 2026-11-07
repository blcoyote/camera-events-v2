import { describe, it, expect } from 'vitest'
import { computeTabBarOffset } from './tabBarViewportRepair'

const base = { navBottom: 800, viewportBottom: 800, viewportScale: 1 }

describe('computeTabBarOffset', () => {
  it('returns 0 when the bar is in sync', () => {
    expect(computeTabBarOffset(base)).toBe(0)
  })

  it('returns a positive offset when the bar is stuck mid-screen', () => {
    expect(computeTabBarOffset({ ...base, navBottom: 500 })).toBe(300)
  })

  it('returns a negative offset when the bar is below the viewport', () => {
    expect(computeTabBarOffset({ ...base, navBottom: 840 })).toBe(-40)
  })

  it('returns 0 for sub-pixel noise', () => {
    expect(computeTabBarOffset({ ...base, navBottom: 799.4 })).toBe(0)
    expect(computeTabBarOffset({ ...base, navBottom: 799 })).toBe(0)
    expect(computeTabBarOffset({ ...base, navBottom: 801 })).toBe(0)
  })

  it('corrects differences just above 1px, rounded to whole px', () => {
    expect(computeTabBarOffset({ ...base, navBottom: 798.4 })).toBe(2)
    expect(computeTabBarOffset({ ...base, navBottom: 500.4 })).toBe(300)
  })

  it('returns 0 when the user has pinch-zoomed', () => {
    expect(
      computeTabBarOffset({ ...base, navBottom: 500, viewportScale: 1.5 }),
    ).toBe(0)
    expect(
      computeTabBarOffset({ ...base, navBottom: 500, viewportScale: 0.98 }),
    ).toBe(0)
  })

  it('tolerates scale within 0.99..1.01', () => {
    expect(
      computeTabBarOffset({ ...base, navBottom: 500, viewportScale: 1.01 }),
    ).toBe(300)
    expect(
      computeTabBarOffset({ ...base, navBottom: 500, viewportScale: 0.99 }),
    ).toBe(300)
  })

  it('returns 0 for non-finite inputs', () => {
    expect(computeTabBarOffset({ ...base, navBottom: NaN })).toBe(0)
    expect(computeTabBarOffset({ ...base, viewportBottom: NaN })).toBe(0)
    expect(computeTabBarOffset({ ...base, viewportScale: NaN })).toBe(0)
    expect(computeTabBarOffset({ ...base, navBottom: Infinity })).toBe(0)
    expect(computeTabBarOffset({ ...base, viewportBottom: -Infinity })).toBe(0)
  })
})
