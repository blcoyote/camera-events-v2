import { useEffect, useRef, useState } from 'react'
import type { VideoRTC } from '#/features/live/vendor/video-rtc.js'

/**
 * A `Location`-shaped input, kept minimal so this is a pure, unit-testable
 * function — no `window`/`location` access happens here.
 */
type LocationLike = Pick<Location, 'protocol' | 'host'>

/**
 * Same-origin go2rtc MSE WebSocket URL the browser connects to. The server
 * proxies this at `/api/live/:camera/ws` (built separately); this only
 * computes the client-side URL, mirroring the protocol/host of the current
 * page so it works behind TLS-terminating proxies in production and plain
 * HTTP in dev.
 */
export function mseWsUrl(camera: string, location: LocationLike): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${location.host}/api/live/${encodeURIComponent(camera)}/ws`
}

export function LiveMsePlayer({ camera }: { camera: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setHasError(false)

    const controller = new AbortController()
    let element: VideoRTC | undefined

    // Media `error` events don't bubble, and VideoRTC creates its inner
    // <video> element itself (not exposed as a prop we control), so we
    // can't attach a listener to it directly ahead of time. A capturing
    // listener on the container still sees the event during the capture
    // phase regardless of the `bubbles` flag, and also catches an `error`
    // dispatched on the custom element itself.
    const onError = () => setHasError(true)
    container.addEventListener('error', onError, true)

    void (async () => {
      const { VideoRTC } = await import('#/features/live/vendor/video-rtc.js')
      if (controller.signal.aborted) return

      if (!customElements.get('video-stream')) {
        customElements.define('video-stream', VideoRTC)
      }

      const el = document.createElement('video-stream') as VideoRTC
      element = el

      // MSE only: no WebRTC (our proxy relays the go2rtc WS and has no P2P
      // port to offer), no HLS/mjpeg/mp4 fallback. iOS 17.1+ uses
      // ManagedMediaSource automatically within the 'mse' code path.
      el.mode = 'mse'
      el.background = false

      container.appendChild(el)

      // Set src only after the element is connected to the DOM: VideoRTC's
      // `onconnect()` (triggered by the `src` setter) requires
      // `this.isConnected` to actually open the WebSocket.
      el.src = mseWsUrl(camera, location)
    })()

    return () => {
      controller.abort()
      container.removeEventListener('error', onError, true)
      if (element) {
        element.ondisconnect()
        element.remove()
      }
    }
  }, [camera, refreshKey])

  return (
    <div className="relative aspect-video overflow-hidden rounded-4xl bg-(--surface-strong)">
      <div
        ref={containerRef}
        className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
        <span className="text-sm font-semibold text-white">{camera}</span>
      </div>
      {hasError && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-center text-sm text-white"
        >
          <p>Live view unavailable</p>
          <button
            type="button"
            className="min-h-11 rounded-full border border-white/40 px-4 py-2 font-semibold"
            onClick={() => {
              setHasError(false)
              setRefreshKey((k) => k + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
