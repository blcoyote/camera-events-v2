import { m } from '#/paraglide/messages.js'
import { useState } from 'react'
import { Maximize } from 'lucide-react'
import { MediaCard } from '#/features/shared/components/MediaCard'
import { SnapshotLightbox } from '#/features/shared/components/SnapshotLightbox'
import { useLiveSnapshot } from '#/features/live-view/hooks/useLiveSnapshot'
import { Button } from '#/features/shared/components/ui/button'

export function LiveSnapshot({ cameraName }: { cameraName: string }) {
  const src = useLiveSnapshot(cameraName)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const alt = m.live_snapshot_alt({ name: cameraName })

  return (
    <>
      <MediaCard
        scanLines={false}
        aria-label={alt}
        image={
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        }
        overlay={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(true)}
            aria-label={m.live_fullscreen()}
            className="absolute right-3 top-3 h-9 w-9 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
          >
            <Maximize size={16} aria-hidden="true" />
          </Button>
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="live-pulse h-2.5 w-2.5 rounded-full bg-danger"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold text-foreground">
            {m.live_badge()}
          </span>
          <span className="text-sm text-fg-2" aria-hidden="true">
            ·
          </span>
          <span className="truncate text-sm font-semibold text-foreground">
            {cameraName}
          </span>
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
