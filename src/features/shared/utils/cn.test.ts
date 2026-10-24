import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('merges conflicting tailwind classes with the later one winning', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-sm', 'text-base')).toBe('text-base')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('supports object syntax', () => {
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })
})
