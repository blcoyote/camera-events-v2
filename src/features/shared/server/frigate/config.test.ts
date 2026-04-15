import { describe, expect, it, afterEach } from 'vitest'
import { getFrigateUrl, DEFAULT_TIMEOUT_MS } from './config'

describe('getFrigateUrl', () => {
  const originalEnv = process.env.FRIGATE_URL

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalEnv
    }
  })

  it('throws a descriptive error when FRIGATE_URL is not set', () => {
    delete process.env.FRIGATE_URL
    expect(() => getFrigateUrl()).toThrow('FRIGATE_URL')
  })

  it('throws a descriptive error when FRIGATE_URL is empty', () => {
    process.env.FRIGATE_URL = ''
    expect(() => getFrigateUrl()).toThrow('FRIGATE_URL')
  })

  it('returns the URL when FRIGATE_URL is set', () => {
    process.env.FRIGATE_URL = 'http://frigate.local:5000'
    expect(getFrigateUrl()).toBe('http://frigate.local:5000')
  })

  it('strips trailing slash from the URL', () => {
    process.env.FRIGATE_URL = 'http://frigate.local:5000/'
    expect(getFrigateUrl()).toBe('http://frigate.local:5000')
  })

  it('strips whitespace from the URL', () => {
    process.env.FRIGATE_URL = '  http://frigate.local:5000  '
    expect(getFrigateUrl()).toBe('http://frigate.local:5000')
  })
})

describe('DEFAULT_TIMEOUT_MS', () => {
  it('is 10 seconds', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000)
  })
})
