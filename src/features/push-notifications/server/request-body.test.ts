import { describe, it, expect } from 'vitest'
import { readBodyField } from './request-body'

describe('readBodyField', () => {
  it('returns the field value for a plain object body', () => {
    expect(readBodyField({ durationMs: 600_000 }, 'durationMs')).toBe(600_000)
  })

  it('returns undefined for a missing key on a plain object body', () => {
    expect(readBodyField({ other: 1 }, 'durationMs')).toBeUndefined()
  })

  it('returns undefined without throwing when the body is null', () => {
    expect(readBodyField(null, 'durationMs')).toBeUndefined()
  })

  it('returns undefined without throwing when the body is undefined', () => {
    expect(readBodyField(undefined, 'durationMs')).toBeUndefined()
  })

  it('returns undefined without throwing when the body is a string', () => {
    expect(readBodyField('nope', 'durationMs')).toBeUndefined()
  })

  it('returns undefined without throwing when the body is a number', () => {
    expect(readBodyField(42, 'durationMs')).toBeUndefined()
  })

  it('returns undefined without throwing when the body is a boolean', () => {
    expect(readBodyField(true, 'durationMs')).toBeUndefined()
  })

  it('returns undefined without throwing when the body is an array', () => {
    expect(readBodyField([], 'durationMs')).toBeUndefined()
  })

  it('returns undefined for a normal key name on an array body', () => {
    expect(readBodyField(['a', 'b', 'c'], 'durationMs')).toBeUndefined()
  })
})
