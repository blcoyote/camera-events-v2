import { describe, expect, it } from 'vitest'
import { mergeCameraOrder } from './mergeCameraOrder'

describe('mergeCameraOrder', () => {
  it('returns Frigate order when saved order is null', () => {
    expect(mergeCameraOrder(null, ['front', 'back', 'garage'])).toEqual([
      'front',
      'back',
      'garage',
    ])
  })

  it('returns Frigate order when saved order is empty', () => {
    expect(mergeCameraOrder([], ['front', 'back', 'garage'])).toEqual([
      'front',
      'back',
      'garage',
    ])
  })

  it('returns saved order when it exactly matches Frigate', () => {
    expect(
      mergeCameraOrder(
        ['garage', 'front', 'back'],
        ['front', 'back', 'garage'],
      ),
    ).toEqual(['garage', 'front', 'back'])
  })

  it('appends new Frigate cameras to the end of the saved order', () => {
    expect(
      mergeCameraOrder(['garage', 'front'], ['front', 'back', 'garage']),
    ).toEqual(['garage', 'front', 'back'])
  })

  it('multiple new cameras are appended in Frigate order', () => {
    expect(
      mergeCameraOrder(['garage'], ['front', 'back', 'garage', 'driveway']),
    ).toEqual(['garage', 'front', 'back', 'driveway'])
  })

  it('drops cameras in saved order that are no longer in Frigate', () => {
    expect(
      mergeCameraOrder(['garage', 'front', 'back'], ['front', 'garage']),
    ).toEqual(['garage', 'front'])
  })

  it('handles interleaved additions and removals', () => {
    // saved: [a, b, c], Frigate: [b, c, d, e]
    // a was removed, d and e are new
    expect(mergeCameraOrder(['a', 'b', 'c'], ['b', 'c', 'd', 'e'])).toEqual([
      'b',
      'c',
      'd',
      'e',
    ])
  })

  it('returns empty array when Frigate list is empty', () => {
    expect(mergeCameraOrder(['front', 'back'], [])).toEqual([])
  })
})
