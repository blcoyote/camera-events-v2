import { Video } from 'lucide-react'
import { MediaCard } from '#/features/shared/components/MediaCard'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import {
  formatRelativeTime,
  formatLabelName,
  getLabelDotColor,
} from '#/features/shared/utils/eventFormatting'
import { EventThumbnail } from './EventThumbnail'
import { useFavoriteToggle } from '#/features/shared/hooks/useFavoriteToggle'
import { FavoriteButton } from '#/features/shared/components/FavoriteButton'

export function EventCard({
  event,
  index,
  initialFavorited = false,
}: {
  event: FrigateEvent
  index: number
  initialFavorited?: boolean
}) {
  const { favorited, pending, error, toggle } = useFavoriteToggle(
    event.id,
    initialFavorited,
  )
  const isRecent = Date.now() / 1000 - event.start_time < 300

  return (
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
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
        <FavoriteButton
          eventId={event.id}
          favorited={favorited}
          pending={pending}
          error={error}
          onToggle={toggle}
        />
      </div>
      {event.zones.length > 0 && (
        <p className="mt-1 truncate text-xs text-(--sea-ink-soft)">
          {event.zones.join(' · ')}
        </p>
      )}
    </MediaCard>
  )
}
