import { useEffect, useRef, useState } from 'react'
import { useInterval } from 'usehooks-ts'
import { useLiveViewRefreshInterval } from '#/features/shared/hooks/useLiveViewRefreshInterval'

export function useLiveSnapshot(cameraName: string): string {
  const [refreshSeconds] = useLiveViewRefreshInterval()
  const intervalMs = refreshSeconds * 1000
  const baseUrl = `/api/cameras/${cameraName}/latest`
  const [src, setSrc] = useState(baseUrl)
  const latestRequestRef = useRef(baseUrl)

  useEffect(() => {
    latestRequestRef.current = baseUrl
    setSrc(baseUrl)
  }, [baseUrl])

  useInterval(() => {
    const next = `${baseUrl}?t=${Date.now()}`
    latestRequestRef.current = next
    const preload = new Image()
    preload.onload = () => {
      if (latestRequestRef.current === next) setSrc(next)
    }
    preload.src = next
  }, intervalMs)

  return src
}
