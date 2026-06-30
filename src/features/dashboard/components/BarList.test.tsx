// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { BarList, computeBarPercents } from './BarList'

afterEach(cleanup)

describe('computeBarPercents', () => {
  it('returns [] for empty input', () => {
    expect(computeBarPercents([])).toEqual([])
  })

  it('scales counts relative to the maximum', () => {
    expect(computeBarPercents([5, 10])).toEqual([50, 100])
  })

  it('returns all zeros when every count is zero', () => {
    expect(computeBarPercents([0, 0])).toEqual([0, 0])
  })
})

describe('BarList', () => {
  it('renders the empty message when there are no items', () => {
    render(<BarList items={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeTruthy()
  })

  it('renders a row per item with its label and count', () => {
    render(
      <BarList
        items={[
          { key: 'a', label: 'Front', count: 3 },
          { key: 'b', label: 'Back', count: 7 },
        ]}
      />,
    )
    expect(screen.getByText('Front')).toBeTruthy()
    expect(screen.getByText('Back')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
  })
})
