import { describe, expect, it } from 'vitest'
import {
  getCamerasPageState,
  getCameraCardData,
} from '#/features/cameras/components/CamerasPage'
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

describe('getCameraCardData', () => {
  it('maps camera name to card data with correct imgSrc', () => {
    const card = getCameraCardData('front_door')

    expect(card.name).toBe('front_door')
    expect(card.imgSrc).toBe('/api/cameras/front_door/latest')
  })

  it('includes descriptive alt text', () => {
    const card = getCameraCardData('front_door')

    expect(card.altText).toBe('Latest snapshot from front_door')
  })

  it('handles different camera names', () => {
    const card = getCameraCardData('backyard')

    expect(card.name).toBe('backyard')
    expect(card.imgSrc).toBe('/api/cameras/backyard/latest')
    expect(card.altText).toBe('Latest snapshot from backyard')
  })

  it('appends cache-busting parameter when refreshKey is provided', () => {
    const card = getCameraCardData('front_door', 3)

    expect(card.imgSrc).toBe('/api/cameras/front_door/latest?t=3')
  })

  it('omits cache-busting parameter when refreshKey is 0', () => {
    const card = getCameraCardData('front_door', 0)

    expect(card.imgSrc).toBe('/api/cameras/front_door/latest')
  })
})
