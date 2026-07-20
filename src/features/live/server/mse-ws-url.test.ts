import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { go2rtcMseWsUrl } from './mse-ws-url'

describe('go2rtcMseWsUrl', () => {
  const originalFrigateUrl = process.env.FRIGATE_URL
  const originalGo2RtcUrl = process.env.FRIGATE_GO2RTC_URL

  beforeEach(() => {
    delete process.env.FRIGATE_GO2RTC_URL
  })

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

  it('builds a ws:// URL from the default go2rtc base for a http FRIGATE_URL', () => {
    process.env.FRIGATE_URL = 'http://frigate:5000'
    expect(go2rtcMseWsUrl('garage')).toBe(
      'ws://frigate:5000/live/webrtc/api/ws?src=garage',
    )
  })

  it('builds a wss:// URL when FRIGATE_URL is https', () => {
    process.env.FRIGATE_URL = 'https://frigate:5000'
    expect(go2rtcMseWsUrl('garage')).toBe(
      'wss://frigate:5000/live/webrtc/api/ws?src=garage',
    )
  })

  it('respects FRIGATE_GO2RTC_URL override', () => {
    process.env.FRIGATE_URL = 'http://frigate:5000'
    process.env.FRIGATE_GO2RTC_URL = 'http://frigate:1984/api'
    expect(go2rtcMseWsUrl('garage')).toBe('ws://frigate:1984/api/ws?src=garage')
  })

  it('URL-encodes the camera name in the query string', () => {
    process.env.FRIGATE_URL = 'http://frigate:5000'
    expect(go2rtcMseWsUrl('front_porch-2')).toBe(
      'ws://frigate:5000/live/webrtc/api/ws?src=front_porch-2',
    )
  })

  it('throws for a path-traversal camera name', () => {
    process.env.FRIGATE_URL = 'http://frigate:5000'
    expect(() => go2rtcMseWsUrl('../etc')).toThrow('Invalid camera name')
  })

  it('throws for a camera name containing a slash', () => {
    process.env.FRIGATE_URL = 'http://frigate:5000'
    expect(() => go2rtcMseWsUrl('a/b')).toThrow('Invalid camera name')
  })

  it('throws for an empty camera name', () => {
    process.env.FRIGATE_URL = 'http://frigate:5000'
    expect(() => go2rtcMseWsUrl('')).toThrow('Invalid camera name')
  })
})
