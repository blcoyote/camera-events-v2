// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  fileURLToPath(new URL('./styles.css', import.meta.url)),
  'utf8',
)

function ruleBody(selector: string): string {
  const start = css.indexOf(`\n  ${selector} {`)
  if (start === -1) return ''
  return css.slice(start, css.indexOf('\n  }', start))
}

describe('root overscroll behaviour', () => {
  // iOS Safari 16+ only reads overscroll-behavior for the page scroller from
  // <html>, and only `none` stops the rubber-band and native pull-to-refresh.
  it('sets overscroll-behavior-y: none on html', () => {
    expect(ruleBody('html')).toContain('overscroll-behavior-y: none;')
  })

  it('does not set overscroll-behavior on body', () => {
    expect(ruleBody('body')).not.toContain('overscroll-behavior')
  })
})

describe('body height', () => {
  // ce-6wc: on short pages iOS standalone left the fixed tab bar floating
  // above the bottom edge; body must fill the dynamic viewport.
  it('sets min-height: 100dvh on body', () => {
    expect(ruleBody('body')).toContain('min-height: 100dvh;')
  })
})
