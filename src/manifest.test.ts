// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../public/manifest.json', import.meta.url)),
    'utf8',
  ),
)

describe('web app manifest', () => {
  it('uses the night-safe dark colour for theme and splash background', () => {
    expect(manifest.theme_color).toBe('#0b1424')
    expect(manifest.background_color).toBe('#0b1424')
  })
})
