import { useEffect, useState } from 'react'

function streamSrc(camera: string, refreshKey: number): string {
  return `/api/live/${encodeURIComponent(camera)}/stream?k=${refreshKey}`
}

export function LiveCameraView({ camera }: { camera: string }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [camera])

  return (
    <div className="relative aspect-video overflow-hidden rounded-4xl bg-(--surface-strong)">
      <img
        src={streamSrc(camera, refreshKey)}
        alt={`Live view of ${camera}`}
        className="h-full w-full object-contain"
        onLoad={() => setHasError(false)}
        onError={() => setHasError(true)}
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
