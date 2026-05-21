import { useState } from 'react'
import {
  formatLabelName,
  formatCameraName,
} from '#/features/shared/utils/eventFormatting'

export function EventClipPlayer({
  eventId,
  camera,
  label,
  onError,
}: {
  eventId: string
  camera: string
  label: string
  onError?: () => void
}) {
  // 'idle' covers the initial pre-error state — the video may or may not
  // be actively playing; we only track whether the browser has surfaced
  // an error event yet.
  const [status, setStatus] = useState<'idle' | 'errored'>('idle')

  const ariaLabel = `Clip of ${formatLabelName(label)} from ${formatCameraName(
    camera,
  )}`

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-2xl">
      {status === 'idle' ? (
        <video
          src={`/api/events/${eventId}/clip`}
          controls
          playsInline
          preload="metadata"
          aria-label={ariaLabel}
          className="h-full w-full"
          onError={() => {
            setStatus('errored')
            onError?.()
          }}
        />
      ) : (
        <div
          role="status"
          className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-(--foam)"
        >
          Couldn't load clip
        </div>
      )}
    </div>
  )
}
