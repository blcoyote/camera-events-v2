import { useState } from 'react'
import { Maximize } from 'lucide-react'
import {
  formatLabelName,
  formatCameraName,
} from '#/features/shared/utils/eventFormatting'
import { SnapshotLightbox } from '#/features/shared/components/SnapshotLightbox'

export function EventSnapshot({
  eventId,
  camera,
  label,
}: {
  eventId: string
  camera: string
  label: string
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const alt = `Snapshot of ${formatLabelName(label)} detected by ${formatCameraName(camera)}`
  const src = `/api/events/${eventId}/snapshot`

  return (
    <>
      <div className="relative overflow-hidden border border-(--line) bg-(--surface) sm:rounded-2xl">
        <img
          src={src}
          alt={alt}
          loading="eager"
          className="h-auto w-full object-contain"
        />
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          aria-label="View fullscreen"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
        >
          <Maximize size={16} aria-hidden="true" />
        </button>
      </div>
      <SnapshotLightbox
        src={src}
        alt={alt}
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
      />
    </>
  )
}
