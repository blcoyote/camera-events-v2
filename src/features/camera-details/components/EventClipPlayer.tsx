import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Maximize } from 'lucide-react'
import { cn } from '#/features/shared/utils/cn'
import { Button } from '#/features/shared/components/ui/button'
import { formatCameraName } from '#/features/shared/utils/eventFormatting'

export function EventClipPlayer({
  eventId,
  camera,
  label,
  poster,
  fallback,
  onZoom,
}: {
  eventId: string
  camera: string
  label: string
  /** Snapshot URL shown before playback starts. */
  poster?: string
  /** Shown (with a compact notice) instead of the error box when the clip fails. */
  fallback?: ReactNode
  /** Adds a zoom button over the playing clip. */
  onZoom?: () => void
}) {
  // 'idle' covers the initial pre-error state — the video may or may not
  // be actively playing; we only track whether the browser has surfaced
  // an error event yet.
  const [status, setStatus] = useState<'idle' | 'errored'>('idle')

  const [retry, setRetry] = useState(0)

  const ariaLabel = m.details_clip_aria({
    label: translateLabel(label, getLocale()),
    camera: formatCameraName(camera),
  })

  const retryButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setRetry((n) => n + 1)
        setStatus('idle')
      }}
    >
      {m.details_try_again()}
    </Button>
  )

  if (status === 'errored' && fallback) {
    return (
      <div>
        {fallback}
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-1 text-sm text-muted-foreground"
        >
          {m.details_clip_error_title()}
          {retryButton}
        </div>
      </div>
    )
  }

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
          poster={poster}
          aria-label={ariaLabel}
          className="h-full w-full"
          onError={() => setStatus('errored')}
        />
      ) : (
        <div
          role="status"
          className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-warm px-4 text-center"
        >
          <p className="text-sm font-semibold text-foreground">
            {m.details_clip_error_title()}
          </p>
          <p className="text-sm text-muted-foreground">
            {m.details_clip_error_body()}
          </p>
          {retryButton}
        </div>
      )}
      {status === 'idle' && onZoom && (
        <button
          type="button"
          onClick={onZoom}
          aria-label={m.details_snapshot_zoom({
            label: translateLabel(label, getLocale()),
            camera: formatCameraName(camera),
          })}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/70"
        >
          <Maximize size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
