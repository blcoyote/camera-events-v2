import { describe, it, expect } from 'vitest'
import { useRefetchOnMount } from './useRefetchOnMount'

describe('useRefetchOnMount', () => {
  it('exports useRefetchOnMount as a function', () => {
    expect(typeof useRefetchOnMount).toBe('function')
  })

  it('accepts a single onRefresh callback without TypeScript error', () => {
    type Options = Parameters<typeof useRefetchOnMount>[0]
    const opts: Options = { onRefresh: async () => {} }
    expect(typeof opts.onRefresh).toBe('function')
  })
})
