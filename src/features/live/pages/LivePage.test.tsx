// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { getLivePageState, LivePage } from './LivePage'

afterEach(() => {
  cleanup()
})

function ok(cameras: string[]): FrigateResult<string[]> {
  return { ok: true, data: cameras }
}
const emptyResult: FrigateResult<string[]> = { ok: true, data: [] }
const errorResult: FrigateResult<string[]> = {
  ok: false,
  error: 'Frigate down',
  status: 503,
}

describe('getLivePageState', () => {
  it('returns cameras state when ok and non-empty', () => {
    expect(getLivePageState(ok(['garage', 'kitchen']))).toEqual({
      kind: 'cameras',
      cameras: ['garage', 'kitchen'],
    })
  })

  it('returns empty state when ok but no cameras', () => {
    expect(getLivePageState(emptyResult)).toEqual({ kind: 'empty' })
  })

  it('returns error state when not ok', () => {
    const state = getLivePageState(errorResult)
    expect(state).toEqual({
      kind: 'error',
      message: 'Could not load cameras. Check that Frigate is running.',
    })
  })
})

describe('LivePage', () => {
  it('shows the live view for the first camera initially', () => {
    render(<LivePage result={ok(['garage', 'kitchen'])} />)
    const img = screen.getByAltText('Live view of garage')
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('/api/live/garage/stream'),
    )
  })

  it('renders a picker button for each camera', () => {
    render(<LivePage result={ok(['garage', 'kitchen'])} />)
    expect(
      screen.getByRole('button', { name: 'Show live view for garage' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Show live view for kitchen' }),
    ).toBeInTheDocument()
  })

  it('switches the live view when a different camera is picked', () => {
    render(<LivePage result={ok(['garage', 'kitchen'])} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Show live view for kitchen' }),
    )
    const img = screen.getByAltText('Live view of kitchen')
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('/api/live/kitchen/stream'),
    )
  })

  it('marks the selected camera button as pressed', () => {
    render(<LivePage result={ok(['garage', 'kitchen'])} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Show live view for kitchen' }),
    )
    expect(
      screen.getByRole('button', { name: 'Show live view for kitchen' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Show live view for garage' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows an empty message when there are no cameras', () => {
    render(<LivePage result={emptyResult} />)
    expect(screen.getByText('No cameras found')).toBeInTheDocument()
  })

  it('shows an error alert when the result is not ok', () => {
    render(<LivePage result={errorResult} />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not load cameras. Check that Frigate is running.',
    )
  })
})
