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

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

function rootBlock(): string {
  const start = css.indexOf(':root {')
  return css.slice(start, css.indexOf('\n}', start))
}

describe('glass fallback surface token', () => {
  it('defines --gl-surface-solid as a primitive in :root', () => {
    expect(css).toContain('--gl-surface-solid: rgba(255, 255, 255, 0.94);')
  })

  it('keeps the literal rgba(255, 255, 255, 0.94) only in :root', () => {
    expect(count(css, 'rgba(255, 255, 255, 0.94)')).toBe(1)
  })

  it('uses the token in the no-backdrop-filter fallback of glass, glass-flat and glass-strong', () => {
    expect(count(css, 'background: var(--gl-surface-solid);')).toBe(3)
  })
})

describe('backdrop blob tokens', () => {
  it('defines --gl-blob-1 and --gl-blob-2 as primitives in :root', () => {
    expect(css).toContain('--gl-blob-1: rgba(79, 140, 255, 0.45);')
    expect(css).toContain('--gl-blob-2: rgba(24, 86, 255, 0.28);')
  })

  it('body::before reads both blob tokens', () => {
    expect(css).toContain('rgba(79, 140, 255, 0.45)')
    expect(css).toMatch(/body::before\s*\{[\s\S]*?var\(--gl-blob-1\)/)
    expect(css).toMatch(/body::before\s*\{[\s\S]*?var\(--gl-blob-2\)/)
  })

  it('keeps each blob literal only in :root', () => {
    expect(count(css, 'rgba(79, 140, 255, 0.45)')).toBe(1)
    expect(count(css, 'rgba(24, 86, 255, 0.28)')).toBe(1)
    expect(rootBlock()).toContain('rgba(79, 140, 255, 0.45)')
    expect(rootBlock()).toContain('rgba(24, 86, 255, 0.28)')
  })
})

describe('event-card hover elevation token', () => {
  it('defines --gl-elev-raised-hover as a primitive in :root', () => {
    expect(css).toContain(
      '--gl-elev-raised-hover: 0 28px 88px rgba(79, 140, 255, 0.26);',
    )
  })

  it('.event-card:hover uses the token for its box-shadow', () => {
    expect(css).toMatch(
      /\.event-card:hover\s*\{[^}]*box-shadow: var\(--gl-elev-raised-hover\);/,
    )
  })

  it('keeps the hover shadow literal only in :root', () => {
    expect(count(css, '0 28px 88px rgba(79, 140, 255, 0.26)')).toBe(1)
    expect(rootBlock()).toContain('0 28px 88px rgba(79, 140, 255, 0.26)')
  })
})
