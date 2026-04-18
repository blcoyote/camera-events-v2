import { describe, expect, it } from 'vitest'
import { PullToRefreshIndicator } from './PullToRefreshIndicator'

describe('PullToRefreshIndicator', () => {
  const threshold = 80

  it('returns null when idle', () => {
    const result = PullToRefreshIndicator({
      pullDistance: 0,
      isRefreshing: false,
      isComplete: false,
      threshold,
    })
    expect(result).toBeNull()
  })

  it('returns an element when pulling', () => {
    const result = PullToRefreshIndicator({
      pullDistance: 40,
      isRefreshing: false,
      isComplete: false,
      threshold,
    })
    expect(result).not.toBeNull()
  })

  it('returns an element when refreshing', () => {
    const result = PullToRefreshIndicator({
      pullDistance: 0,
      isRefreshing: true,
      isComplete: false,
      threshold,
    })
    expect(result).not.toBeNull()
  })

  it('returns an element when complete', () => {
    const result = PullToRefreshIndicator({
      pullDistance: 0,
      isRefreshing: false,
      isComplete: true,
      threshold,
    })
    expect(result).not.toBeNull()
  })

  it('returns null when all values are idle defaults', () => {
    const result = PullToRefreshIndicator({
      pullDistance: 0,
      isRefreshing: false,
      isComplete: false,
      threshold,
    })
    expect(result).toBeNull()
  })
})
