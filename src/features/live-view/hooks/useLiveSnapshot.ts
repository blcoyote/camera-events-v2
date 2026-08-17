import { useEffect, useRef, useState } from 'react'
import { useInterval } from 'usehooks-ts'

const REFRESH_INTERVAL_MS = 2000

export function useLiveSnapshot(
  cameraName: string,
  intervalMs = REFRESH_INTERVAL_MS,
): string {
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
