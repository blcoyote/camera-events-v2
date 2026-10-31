// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'

afterEach(cleanup)

describe('PageHeader', () => {
  it('renders the title as a visually-hidden-on-phones h1', () => {
    render(<PageHeader eyebrow="Cameras" title="Latest snapshots" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Latest snapshots')
    expect(h1).toHaveClass('sr-only', 'sm:not-sr-only')
  })

  it('hides the eyebrow on phones', () => {
    render(<PageHeader eyebrow="Cameras" title="T" />)
    expect(screen.getByText('Cameras')).toHaveClass('hidden', 'sm:block')
  })

  it('renders actions when given', () => {
    render(
      <PageHeader eyebrow="E" title="T" actions={<button>Do it</button>} />,
    )
    expect(screen.getByRole('button', { name: 'Do it' })).toBeInTheDocument()
  })

  it('only applies the glass card from sm upwards', () => {
    const { container } = render(<PageHeader eyebrow="E" title="T" />)
    const section = container.querySelector('section')!
    expect(section).toHaveClass('sm:glass')
    expect(section).not.toHaveClass('glass')
    expect(section).not.toHaveClass('px-5')
  })

  it('uses larger padding for the spacious variant', () => {
    const { container } = render(
      <PageHeader eyebrow="E" title="T" variant="spacious" />,
    )
    expect(container.querySelector('section')).toHaveClass(
      'sm:px-10',
      'sm:py-14',
    )
  })
})
