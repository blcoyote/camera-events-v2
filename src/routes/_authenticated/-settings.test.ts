import { describe, expect, it } from 'vitest'
import { getSettingsContent } from '#/pages/settings/SettingsPage'

describe('getSettingsContent', () => {
  it('returns heading and description', () => {
    const content = getSettingsContent()
    expect(content.heading).toBe('Settings')
    expect(typeof content.description).toBe('string')
    expect(content.description.length).toBeGreaterThan(0)
  })

  it('does not contain placeholder text', () => {
    const content = getSettingsContent()
    expect(content.description).not.toContain('will appear here')
  })
})
