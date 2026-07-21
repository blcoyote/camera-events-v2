import { describe, expect, it, afterEach } from 'vitest'
import { getFrigateUrl, getGo2RtcBase, DEFAULT_TIMEOUT_MS } from './config'

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

describe('getGo2RtcBase', () => {
  const originalFrigateUrl = process.env.FRIGATE_URL
  const originalGo2RtcUrl = process.env.FRIGATE_GO2RTC_URL

  afterEach(() => {
    if (originalFrigateUrl === undefined) {
      delete process.env.FRIGATE_URL
    } else {
      process.env.FRIGATE_URL = originalFrigateUrl
    }
    if (originalGo2RtcUrl === undefined) {
      delete process.env.FRIGATE_GO2RTC_URL
    } else {
      process.env.FRIGATE_GO2RTC_URL = originalGo2RtcUrl
    }
  })

  it('derives from FRIGATE_URL + /live/mse/api by default', () => {
    delete process.env.FRIGATE_GO2RTC_URL
    process.env.FRIGATE_URL = 'http://frigate.local:5000'
    expect(getGo2RtcBase()).toBe('http://frigate.local:5000/live/mse/api')
  })

  it('uses FRIGATE_GO2RTC_URL when set, overriding the FRIGATE_URL derivation', () => {
    process.env.FRIGATE_URL = 'http://frigate.local:5000'
    process.env.FRIGATE_GO2RTC_URL = 'http://go2rtc.local:1984'
    expect(getGo2RtcBase()).toBe('http://go2rtc.local:1984')
  })

  it('trims whitespace and strips trailing slashes from FRIGATE_GO2RTC_URL', () => {
    process.env.FRIGATE_URL = 'http://frigate.local:5000'
    process.env.FRIGATE_GO2RTC_URL = '  http://go2rtc.local:1984/  '
    expect(getGo2RtcBase()).toBe('http://go2rtc.local:1984')
  })

  it('ignores a blank FRIGATE_GO2RTC_URL and falls back to FRIGATE_URL derivation', () => {
    process.env.FRIGATE_URL = 'http://frigate.local:5000'
    process.env.FRIGATE_GO2RTC_URL = '   '
    expect(getGo2RtcBase()).toBe('http://frigate.local:5000/live/mse/api')
  })
})
