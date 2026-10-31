import { describe, it, expect } from 'vitest'
import { splitAroundIcon, ICON_SENTINEL } from './splitAroundIcon'

describe('splitAroundIcon', () => {
  it('splits a message on the sentinel', () => {
    expect(splitAroundIcon(`Drag ${ICON_SENTINEL} now`)).toEqual([
      'Drag ',
      ' now',
    ])
  })
  it('returns a single part without sentinel', () => {
    expect(splitAroundIcon('plain')).toEqual(['plain'])
  })
})
