import { Heart } from 'lucide-react'
import { toggleFavoriteFn } from '../server/favorites'

export function FavoriteButton({
  eventId,
  eventLabel,
  className = '',
}: {
  eventId: string
  eventLabel?: string
  className?: string
}) {
  const label = eventLabel ? `Favorite ${eventLabel}` : 'Favorite this event'

  return (
    <button
      type="button"
      aria-label={label}
      className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-(--sea-ink-soft) transition hover:text-red-500 ${className}`}
      onClick={() => {
        void toggleFavoriteFn({ data: eventId })
      }}
    >
      <Heart size={16} aria-hidden="true" />
    </button>
  )
}
