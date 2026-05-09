import { useState } from 'react'
import { Video } from 'lucide-react'
import { MediaCard } from '#/features/shared/components/MediaCard'
import { FavoriteButton } from './FavoriteButton'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { formatRelativeTime, formatLabelName, getLabelDotColor } from '../utils'

function EventThumbnail({ eventId }: { eventId: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex aspect-video items-center justify-center bg-(--surface) text-(--sea-ink-soft)">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="opacity-40"
        >
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
          <rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={`/api/events/${eventId}/thumbnail`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  )
}

export function EventCard({
  event,
  index,
  isFavorited,
}: {
  event: FrigateEvent
  index: number
  isFavorited: boolean
}) {
  const isRecent = Date.now() / 1000 - event.start_time < 300

  return (
    <div className="relative">
      <MediaCard
        to="/camera-events/$id"
        params={{ id: event.id }}
        aria-label={`${formatLabelName(event.label)} detected by ${event.camera}, ${formatRelativeTime(event.start_time)}`}
        index={index}
        image={<EventThumbnail eventId={event.id} />}
        overlay={
          <>
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: getLabelDotColor(event.label) }}
                  aria-hidden="true"
                />
                {formatLabelName(event.label)}
              </span>
              {event.sub_label && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                  {event.sub_label}
                </span>
              )}
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {isRecent && (
                <span
                  className="live-pulse h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                  role="img"
                  aria-label="Recent event"
                />
              )}
              {event.has_clip && (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                  role="img"
                  aria-label="Has video clip"
                >
                  <Video size={12} className="text-white" aria-hidden="true" />
                </span>
              )}
            </div>
          </>
        }
      >
        <div className="flex items-center justify-between gap-2 pr-10">
          <p className="truncate text-sm font-semibold text-(--sea-ink)">
            {event.camera}
          </p>
          <time
            dateTime={new Date(event.start_time * 1000).toISOString()}
            className="shrink-0 text-xs text-(--sea-ink-soft)"
            suppressHydrationWarning
          >
            {formatRelativeTime(event.start_time)}
          </time>
        </div>
        {event.zones.length > 0 && (
          <p className="mt-1 truncate text-xs text-(--sea-ink-soft)">
            {event.zones.join(' · ')}
          </p>
        )}
      </MediaCard>
      <FavoriteButton
        eventId={event.id}
        eventLabel={`${formatLabelName(event.label)} detected by ${event.camera}`}
        isFavorited={isFavorited}
        className="absolute bottom-2.5 right-3 z-10"
      />
    </div>
  )
}
