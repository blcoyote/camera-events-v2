import { describe, expect, it } from 'vitest'
import { CamerasLoading } from './CamerasLoading'
import { withLocale } from '#/test-utils/locale'

describe('CamerasLoading', () => {
  it('renders English by default', () => {
    expect(JSON.stringify(CamerasLoading())).toContain('Loading cameras…')
  })

  it('renders Danish', () => {
    const restore = withLocale('da')
    try {
      const json = JSON.stringify(CamerasLoading())
      expect(json).toContain('Indlæser kameraer…')
      expect(json).toContain('Indlæser kameraer"')
    } finally {
      restore()
    }
  })
})
