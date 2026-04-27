import { describe, expect, it } from 'vitest'
import { getCamerasPageState } from '#/features/cameras/components/CamerasPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

describe('getCamerasPageState', () => {
  it('returns "cameras" state with camera list on success', () => {
    const result: FrigateResult<string[]> = {
      ok: true,
      data: ['backyard', 'front_door', 'garage'],
    }
    const state = getCamerasPageState(result)

    expect(state.kind).toBe('cameras')
    if (state.kind === 'cameras') {
      expect(state.cameras).toEqual(['backyard', 'front_door', 'garage'])
    }
  })

  it('returns "empty" state when camera list is empty', () => {
    const result: FrigateResult<string[]> = { ok: true, data: [] }
    const state = getCamerasPageState(result)

    expect(state.kind).toBe('empty')
  })

  it('returns "error" state when Frigate is unreachable', () => {
    const result: FrigateResult<string[]> = { ok: false, error: 'fetch failed' }
    const state = getCamerasPageState(result)

    expect(state.kind).toBe('error')
    if (state.kind === 'error') {
      expect(state.message).toBeTruthy()
    }
  })
})
