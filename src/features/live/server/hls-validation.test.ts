import { describe, expect, it } from 'vitest'
import {
  isValidHlsSegmentRef,
  MAX_HLS_SEGMENT_REF_LENGTH,
} from './hls-validation'

describe('isValidHlsSegmentRef', () => {
  describe('valid refs', () => {
    it('returns true for a plain segment filename', () => {
      expect(isValidHlsSegmentRef('segment0.mp4')).toBe(true)
    })

    it('returns true for an init segment with a query string', () => {
      expect(isValidHlsSegmentRef('init.mp4?src=garage')).toBe(true)
    })

    it('returns true for a segment ref with multiple query params', () => {
      expect(isValidHlsSegmentRef('segment123.m4s?id=abc-DEF_9&n=42')).toBe(
        true,
      )
    })

    it('returns true for a filename with underscores and hyphens', () => {
      expect(isValidHlsSegmentRef('front_porch-segment0.mp4')).toBe(true)
    })

    it('returns true for a filename with a tilde and parentheses', () => {
      expect(isValidHlsSegmentRef('seg~ment(1).mp4')).toBe(true)
    })

    it('returns true at exactly the max length boundary', () => {
      const ref = 'a'.repeat(MAX_HLS_SEGMENT_REF_LENGTH)
      expect(isValidHlsSegmentRef(ref)).toBe(true)
    })
  })

  describe('empty / whitespace', () => {
    it('returns false for an empty string', () => {
      expect(isValidHlsSegmentRef('')).toBe(false)
    })

    it('returns false for a whitespace-only string', () => {
      expect(isValidHlsSegmentRef('   ')).toBe(false)
    })

    it('returns false for a ref containing an internal space', () => {
      expect(isValidHlsSegmentRef('segment 0.mp4')).toBe(false)
    })

    it('returns false for a ref containing a tab character', () => {
      expect(isValidHlsSegmentRef('segment\t0.mp4')).toBe(false)
    })
  })

  describe('absolute URLs / scheme', () => {
    it('returns false for an http:// URL', () => {
      expect(isValidHlsSegmentRef('http://evil.com/x')).toBe(false)
    })

    it('returns false for an https:// URL', () => {
      expect(isValidHlsSegmentRef('https://evil.com/x')).toBe(false)
    })

    it('returns false for a scheme match case-insensitively', () => {
      expect(isValidHlsSegmentRef('HTTPS://EVIL.COM/x')).toBe(false)
    })

    it('returns false for a protocol-relative //host/path ref', () => {
      expect(isValidHlsSegmentRef('//evil.com/path')).toBe(false)
    })

    it('returns false for a file:// URL', () => {
      expect(isValidHlsSegmentRef('file:///etc/passwd')).toBe(false)
    })
  })

  describe('absolute / UNC paths and backslashes', () => {
    it('returns false for a ref starting with a forward slash', () => {
      expect(isValidHlsSegmentRef('/etc/passwd')).toBe(false)
    })

    it('returns false for a ref starting with a backslash', () => {
      expect(isValidHlsSegmentRef('\\\\server\\share')).toBe(false)
    })

    it('returns false for a ref containing a backslash anywhere', () => {
      expect(isValidHlsSegmentRef('segment0\\..\\mp4')).toBe(false)
    })
  })

  describe('path traversal', () => {
    it('returns false for a leading ../', () => {
      expect(isValidHlsSegmentRef('../secret.mp4')).toBe(false)
    })

    it('returns false for an embedded ../', () => {
      expect(isValidHlsSegmentRef('foo/../bar.mp4')).toBe(false)
    })

    it('returns false for a bare ..', () => {
      expect(isValidHlsSegmentRef('..')).toBe(false)
    })

    it('returns false for .. inside a query string', () => {
      expect(isValidHlsSegmentRef('segment0.mp4?src=../etc')).toBe(false)
    })
  })

  describe('control characters', () => {
    it('returns false for a null byte', () => {
      expect(isValidHlsSegmentRef('segment\0.mp4')).toBe(false)
    })

    it('returns false for a control character (0x01)', () => {
      expect(isValidHlsSegmentRef('segment\x010.mp4')).toBe(false)
    })

    it('returns false for the DEL control character (0x7F)', () => {
      expect(isValidHlsSegmentRef('segment\x7F0.mp4')).toBe(false)
    })
  })

  describe('userinfo / other dangerous characters', () => {
    it('returns false for a ref containing @', () => {
      expect(isValidHlsSegmentRef('user@evil.com/path')).toBe(false)
    })

    it('returns false for a ref containing a colon (scheme-like)', () => {
      expect(isValidHlsSegmentRef('seg:ment0.mp4')).toBe(false)
    })
  })

  describe('length boundary', () => {
    it('returns false for a ref exceeding the max length', () => {
      const ref = 'a'.repeat(MAX_HLS_SEGMENT_REF_LENGTH + 1)
      expect(isValidHlsSegmentRef(ref)).toBe(false)
    })
  })

  describe('unicode', () => {
    it('returns false for a ref containing non-ASCII characters', () => {
      expect(isValidHlsSegmentRef('café.mp4')).toBe(false)
    })

    it('returns false for a ref containing an emoji', () => {
      expect(isValidHlsSegmentRef('segment😀.mp4')).toBe(false)
    })
  })
})
