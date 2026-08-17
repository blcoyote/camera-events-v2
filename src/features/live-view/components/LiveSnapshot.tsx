import { useState } from 'react'
import { Maximize } from 'lucide-react'
import { MediaCard } from '#/features/shared/components/MediaCard'
import { SnapshotLightbox } from '#/features/shared/components/SnapshotLightbox'
import { useLiveSnapshot } from '#/features/live-view/hooks/useLiveSnapshot'

export function LiveSnapshot({ cameraName }: { cameraName: string }) {
  const src = useLiveSnapshot(cameraName)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const alt = `Live snapshot from ${cameraName}`

  return (
    <>
      <MediaCard
        scanLines={false}
        aria-label={alt}
        image={
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        }
        overlay={
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            aria-label="View fullscreen"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
          >
            <Maximize size={16} aria-hidden="true" />
          </button>
        }
      >
        <div className="flex items-center gap-2">
          <span
            className="live-pulse h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-(--sea-ink)">Live</span>
        </div>
      </MediaCard>
      <SnapshotLightbox
        src={src}
        alt={alt}
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
      />
    </>
  )
}
