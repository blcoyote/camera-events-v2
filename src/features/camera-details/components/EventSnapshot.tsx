import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { Maximize } from 'lucide-react'
import { formatCameraName } from '#/features/shared/utils/eventFormatting'

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
  const args = {
    label: translateLabel(label, getLocale()),
    camera: formatCameraName(camera),
  }
  const altText = m.details_snapshot_alt(args)
  const src = `/api/events/${eventId}/snapshot`
  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label={m.details_snapshot_zoom(args)}
      className="relative block w-full cursor-zoom-in overflow-hidden border border-border-soft bg-card sm:rounded-card"
    >
      <img
        src={src}
        alt={altText}
        className="h-auto w-full object-contain"
        loading="eager"
      />
      <span className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70">
        <Maximize size={16} aria-hidden="true" />
      </span>
    </button>
  )
}
