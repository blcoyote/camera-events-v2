import { describe, it, expect } from 'vitest'
import { handleToggleFavorite } from './favorites'

describe('handleToggleFavorite', () => {
  it('returns error for invalid event ID with path traversal', () => {
    expect(handleToggleFavorite('../etc/passwd', 'user-123')).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('returns error for empty event ID', () => {
    expect(handleToggleFavorite('', 'user-123')).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('returns error for event ID with spaces', () => {
    expect(handleToggleFavorite('bad event id', 'user-123')).toEqual({
      ok: false,
      error: 'Invalid event ID',
    })
  })

  it('returns ok for a valid event ID', () => {
    expect(
      handleToggleFavorite('1713095000.123456-abcdef', 'user-123'),
    ).toEqual({
      ok: true,
    })
  })
})
