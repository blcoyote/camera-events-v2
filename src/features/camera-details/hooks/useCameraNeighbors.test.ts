// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

const loadFn = vi.fn()
// a plain function: vi.fn would observe the rejected promise as unhandled
let failNext = false
vi.mock('../server/load-neighbors', () => ({
  loadCameraNeighborsFn: (a: unknown) =>
    failNext ? Promise.reject(new Error('x')) : loadFn(a),
}))
const { useCameraNeighbors } = await import('./useCameraNeighbors')

const ref = (id: string) => ({ id, label: 'person', start_time: 1 })
const ev = (id: string) => ({ id, camera: 'driveway', start_time: 100 })

beforeEach(() => {
  loadFn.mockReset()
  failNext = false
})
afterEach(cleanup)

describe('useCameraNeighbors', () => {
  it('starts loading, then ready with data', async () => {
    loadFn.mockResolvedValue({ previous: ref('p'), next: null })
    const { result } = renderHook(() => useCameraNeighbors(ev('a')))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.previous?.id).toBe('p')
    expect(result.current.next).toBeNull()
    expect(loadFn).toHaveBeenCalledWith({
      data: { eventId: 'a', camera: 'driveway', startTime: 100 },
    })
  })

  it('reports error when the call rejects', async () => {
    failNext = true
    const { result } = renderHook(() => useCameraNeighbors(ev('a')))
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('does not fetch for a null event', () => {
    const { result } = renderHook(() => useCameraNeighbors(null))
    expect(result.current.status).toBe('loading')
    expect(loadFn).not.toHaveBeenCalled()
  })

  it('ignores stale responses after the event changes', async () => {
    let resolveA: (v: unknown) => void = () => {}
    loadFn.mockImplementationOnce(() => new Promise((r) => (resolveA = r)))
    loadFn.mockResolvedValueOnce({ previous: ref('pb'), next: null })
    const { result, rerender } = renderHook(({ e }) => useCameraNeighbors(e), {
      initialProps: { e: ev('a') },
    })
    rerender({ e: ev('b') })
    await waitFor(() => expect(result.current.previous?.id).toBe('pb'))
    resolveA({ previous: ref('pa'), next: null })
    await Promise.resolve()
    expect(result.current.previous?.id).toBe('pb')
  })
})
