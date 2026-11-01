import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { withLocale } from '#/test-utils/locale'
import { NotFound } from './-not-found'

vi_mock_link()
function vi_mock_link() {}

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}))

describe('NotFound', () => {
  let restore = () => {}
  afterEach(() => restore())

  it('renders Danish copy', () => {
    restore = withLocale('da')
    const html = renderToStaticMarkup(<NotFound />)
    expect(html).toContain('Siden blev ikke fundet')
    expect(html).toContain('Til forsiden')
  })
})
