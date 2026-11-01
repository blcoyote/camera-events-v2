import { useEffect, useState } from 'react'
import { loadCameraNeighborsFn } from '../server/load-neighbors'
import type { EventRef } from '../utils/neighbors'

export interface CameraNeighbors {
  status: 'loading' | 'ready' | 'error'
  previous: EventRef | null
  next: EventRef | null
}

const LOADING: CameraNeighbors = {
  status: 'loading',
  previous: null,
  next: null,
}

export function useCameraNeighbors(
  event: { id: string; camera: string; start_time: number } | null,
): CameraNeighbors {
  const [state, setState] = useState<CameraNeighbors>(LOADING)
  const id = event?.id
  const camera = event?.camera
  const startTime = event?.start_time

  useEffect(() => {
    if (id === undefined || camera === undefined || startTime === undefined) {
      return
    }
    let cancelled = false
    setState(LOADING)
    loadCameraNeighborsFn({ data: { eventId: id, camera, startTime } })
      .then((r) => {
        if (!cancelled) setState({ status: 'ready', ...r })
      })
      .catch(() => {
        if (!cancelled)
          setState({ status: 'error', previous: null, next: null })
      })
    return () => {
      cancelled = true
    }
  }, [id, camera, startTime])

  return state
}
