import { Maximize } from 'lucide-react'
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
}) {
  const altText = `Snapshot of ${formatLabelName(label)} detected by ${formatCameraName(camera)}`
  const src = `/api/events/${eventId}/snapshot`
  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label={`${altText} — tap to view fullscreen`}
      className="relative block w-full cursor-zoom-in overflow-hidden border border-(--line) bg-(--surface) sm:rounded-2xl"
    >
      <img
        src={src}
        alt={altText}
        className="h-auto w-full object-contain"
        loading="eager"
      />
      <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70">
        <Maximize size={16} aria-hidden="true" />
      </span>
    </button>
  )
}
