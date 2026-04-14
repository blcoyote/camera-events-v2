import { describe, expect, it } from 'vitest'
import { getSettingsContent } from './settings'

describe('getSettingsContent', () => {
  it('returns heading and description', () => {
    const content = getSettingsContent()
    expect(content.heading).toBe('Settings')
    expect(typeof content.description).toBe('string')
    expect(content.description.length).toBeGreaterThan(0)
  })
})
