import { useEffect, useRef, useState } from 'react'

function streamSrc(camera: string): string {
  return `/api/live/${encodeURIComponent(camera)}/stream`
}

export function LiveCameraView({ camera }: { camera: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    setHasError(false)

    const controller = new AbortController()
    const src = streamSrc(camera)
    const onError = () => setHasError(true)

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      video.addEventListener('error', onError)
      return () => {
        video.removeEventListener('error', onError)
        video.removeAttribute('src')
        video.load()
      }
    }

    let hlsInstance: { destroy: () => void } | undefined

    void (async () => {
      const { default: Hls } = await import('hls.js')
      if (controller.signal.aborted) return

      if (!Hls.isSupported()) {
        onError()
        return
      }

      const hls = new Hls()
      hlsInstance = hls
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) onError()
      })
      hls.loadSource(src)
      hls.attachMedia(video)
    })()

    return () => {
      controller.abort()
      hlsInstance?.destroy()
    }
  }, [camera, refreshKey])

  return (
    <div className="relative aspect-video overflow-hidden rounded-4xl bg-(--surface-strong)">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        controls
        aria-label={`Live view of ${camera}`}
        className="h-full w-full object-contain"
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
