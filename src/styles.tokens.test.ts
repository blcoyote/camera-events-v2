// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
)

describe('destructive fill token', () => {
  it('defines --gl-danger-fill as a primitive in :root', () => {
    expect(css).toContain('--gl-danger-fill: #c81e3a;')
  })

  it('points --destructive at the fill token, not the text token', () => {
    expect(css).toContain('--destructive: var(--gl-danger-fill);')
  })
})
