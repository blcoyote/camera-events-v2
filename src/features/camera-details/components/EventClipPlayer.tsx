import { useState } from 'react'
import { cn } from '#/features/shared/utils/cn'
import { Button } from '#/features/shared/components/ui/button'
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

  const [retry, setRetry] = useState(0)

  const ariaLabel = `Clip of ${formatLabelName(label)} from ${formatCameraName(
    camera,
  )}`

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden sm:rounded-card',
        status === 'idle' ? 'bg-black' : 'border border-border-soft',
      )}
    >
      {status === 'idle' ? (
        <video
          key={retry}
          src={`/api/events/${eventId}/clip${retry > 0 ? `?retry=${retry}` : ''}`}
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
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-warm px-4 text-center"
        >
          <p className="text-sm font-semibold text-foreground">
            Couldn't load clip
          </p>
          <p className="text-sm text-muted-foreground">
            Frigate may still be saving it, or it may no longer be stored.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRetry((n) => n + 1)
              setStatus('idle')
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
