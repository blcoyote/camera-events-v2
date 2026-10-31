import { describe, it, expect } from 'vitest'
import { HeadContent } from '@tanstack/react-router'
import { Route } from './__root'
import { buildThemeInitScript } from '#/features/shared/hooks/themeMode'

type Meta = Record<string, unknown>

type El = { type: unknown; props: Record<string, any> }

/** Calls RootDocument (the shellComponent) and returns its element tree without rendering. */
function renderShell(): El {
  const { shellComponent } = Route.options as unknown as {
    shellComponent: (p: { children: unknown }) => El
  }
  const shell = shellComponent
  return shell({ children: null })
}

function htmlAndHeadChildren() {
  const html = renderShell()
  const kids = html.props.children as El[]
  const head = kids.find((c) => c.type === 'head') as El
  const headKids = head.props.children as unknown[]
  return {
    html,
    headKids: Array.isArray(headKids) ? headKids : [headKids],
  }
}

function getHead() {
  const head = Route.options.head?.({} as never) as
    | { meta?: Meta[]; scripts?: Meta[] }
    | undefined
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

describe('root document shell', () => {
  it('marks <html> with suppressHydrationWarning', () => {
    const { html } = htmlAndHeadChildren()
    expect(html.props.suppressHydrationWarning).toBe(true)
  })

  it('renders the theme init script inside <head>', () => {
    const { headKids } = htmlAndHeadChildren()
    const script = headKids.find((c) => (c as El).type === 'script') as
      | El
      | undefined
    expect(script).toBeDefined()
    expect(script?.props.dangerouslySetInnerHTML).toEqual({
      __html: buildThemeInitScript(),
    })
  })

  it('places the theme init script after <HeadContent />', () => {
    const { headKids } = htmlAndHeadChildren()
    const headContentIndex = headKids.findIndex(
      (c) => (c as El).type === HeadContent,
    )
    const scriptIndex = headKids.findIndex((c) => (c as El).type === 'script')
    expect(headContentIndex).toBeGreaterThanOrEqual(0)
    expect(scriptIndex).toBeGreaterThan(headContentIndex)
  })
})
