import { ZoomIn } from 'lucide-react'
import {
  formatLabelName,
  formatCameraName,
} from '#/features/shared/utils/eventFormatting'

export function EventSnapshot({
  eventId,
  camera,
  label,
  onZoom,
}: {
  eventId: string
  camera: string
  label: string
  onZoom: () => void
  showBoundingBox?: boolean
}) {
  const altText = `Snapshot of ${formatLabelName(label)} detected by ${formatCameraName(camera)}`
  const src = `/api/events/${eventId}/snapshot`
  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label={`${altText} — tap to zoom`}
      className="group relative block w-full cursor-zoom-in overflow-hidden border border-(--line) bg-(--surface) sm:rounded-2xl"
    >
      <img
        src={src}
        alt={altText}
        className="h-auto w-full object-contain"
        loading="eager"
      />
      <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white opacity-60 transition group-hover:opacity-100">
        <ZoomIn className="h-4 w-4" />
      </span>
    </button>
  )
}
