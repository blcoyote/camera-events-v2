import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { formatCameraName } from '#/features/shared/utils/eventFormatting'
import { formatTime } from '#/features/shared/utils/intl'
import { translateLabel } from '#/features/shared/utils/labels'
import type { EventRef } from '../utils/neighbors'

interface BurstNavProps {
  camera: string
  status: 'loading' | 'ready' | 'error'
  previous: EventRef | null
  next: EventRef | null
}

function NeighborLink({
  event,
  side,
}: {
  event: EventRef
  side: 'previous' | 'next'
}) {
  const locale = getLocale()
  const isNext = side === 'next'
  const Icon = isNext ? ChevronRight : ChevronLeft
  return (
    <Link
      to="/camera-events/$id"
      params={{ id: event.id }}
      className={`flex min-h-11 items-center gap-1 ${isNext ? 'ml-auto text-right' : ''}`}
    >
      {!isNext && <Icon className="size-5 shrink-0" aria-hidden />}
      <span className="flex flex-col">
        <span className="text-xs text-muted-foreground">
          {isNext ? m.details_burst_next() : m.details_burst_previous()}
        </span>
        <span className="text-sm text-brand-strong">
          {translateLabel(event.label, locale)} ·{' '}
          {formatTime(event.start_time, locale)}
        </span>
      </span>
      {isNext && <Icon className="size-5 shrink-0" aria-hidden />}
    </Link>
  )
}

export function BurstNav({ camera, status, previous, next }: BurstNavProps) {
  const name = formatCameraName(camera)
  return (
    <nav
      aria-label={m.details_burst_nav_label({ camera: name })}
      className="border-y border-border-soft py-1"
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4">
        {status === 'ready' && (
          <>
            {previous && <NeighborLink event={previous} side="previous" />}
            {next ? (
              <NeighborLink event={next} side="next" />
            ) : (
              <span className="ml-auto text-sm text-muted-foreground">
                {m.details_burst_nothing_since({ camera: name })}
              </span>
            )}
          </>
        )}
      </div>
    </nav>
  )
}
