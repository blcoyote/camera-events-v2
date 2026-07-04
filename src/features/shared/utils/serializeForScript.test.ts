import { describe, it, expect } from 'vitest'
import { serializeForScript } from './serializeForScript'

describe('serializeForScript', () => {
  it('round-trips a plain object to the same value via JSON.parse', () => {
    const value = { a: 1, b: 'two', c: [1, 2, 3], d: null }

    expect(JSON.parse(serializeForScript(value))).toEqual(value)
  })

  it('round-trips an array to the same value via JSON.parse', () => {
    const value = ['ocean', 'forest', 'sunset']

    expect(JSON.parse(serializeForScript(value))).toEqual(value)
  })

  it('escapes < to \\u003c and does not contain a literal </script', () => {
    const output = serializeForScript('</script><script>alert(1)</script>')

    expect(output).toContain('\\u003c')
    expect(output.toLowerCase()).not.toContain('</script')
  })

  it('escapes > to \\u003e', () => {
    const output = serializeForScript('a>b')

    expect(output).toContain('\\u003e')
    expect(output).not.toContain('>')
  })

  it('escapes & to \\u0026', () => {
    const output = serializeForScript('a&b')

    expect(output).toContain('\\u0026')
    expect(output).not.toContain('&')
  })

  it('escapes U+2028 (line separator) to \\u2028', () => {
    const output = serializeForScript('a b')

    expect(output).toContain('\\u2028')
    expect(output).not.toContain(' ')
  })

  it('escapes U+2029 (paragraph separator) to \\u2029', () => {
    const output = serializeForScript('a b')

    expect(output).toContain('\\u2029')
    expect(output).not.toContain(' ')
  })

  it('produces byte-identical output to JSON.stringify when no special characters are present', () => {
    const value = {
      palettes: ['ocean', 'forest'],
      count: 3,
      nested: { ok: true },
    }

    expect(serializeForScript(value)).toBe(JSON.stringify(value))
  })
})
