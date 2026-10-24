import { describe, it, expect } from 'vitest'
import { Route } from './__root'

type Meta = Record<string, unknown>

function getHead() {
  const head = Route.options.head?.({} as never) as
    { meta?: Meta[]; scripts?: Meta[] } | undefined
  return head ?? {}
}

function metaContent(name: string): unknown {
  return getHead().meta?.find((m) => m.name === name)?.content
}

describe('root route head()', () => {
  it('sets a static light theme-color', () => {
    expect(metaContent('theme-color')).toBe('#eef6ff')
  })

  it('uses the default iOS status bar style', () => {
    expect(metaContent('apple-mobile-web-app-status-bar-style')).toBe('default')
  })

  it('does not inject a theme init script', () => {
    expect(JSON.stringify(getHead())).not.toContain("getItem('theme')")
  })
})
