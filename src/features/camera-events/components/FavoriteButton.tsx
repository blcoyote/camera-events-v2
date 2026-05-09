import { useEffect, useState } from 'react'
import { Heart, AlertCircle } from 'lucide-react'

export interface FavoriteButtonProps {
  eventId: string
  favorited: boolean
  pending: boolean
  error: string | null
  onToggle: () => void
}

const ERROR_DISMISS_MS = 4000

export function FavoriteButton({
  favorited,
  pending,
  error,
  onToggle,
}: FavoriteButtonProps) {
  const [visibleError, setVisibleError] = useState(error)

  useEffect(() => {
    if (!error) {
      setVisibleError(null)
      return
    }
    setVisibleError(error)
    const timer = setTimeout(() => setVisibleError(null), ERROR_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [error])

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label={
          pending
            ? 'Saving…'
            : favorited
              ? 'Remove from favorites'
              : 'Add to favorites'
        }
        aria-pressed={favorited}
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          onToggle()
        }}
        className="flex items-center justify-center rounded-full p-2.5 text-(--sea-ink-soft) transition hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Heart
          size={20}
          aria-hidden="true"
          className={favorited ? 'fill-red-500 text-red-500' : ''}
        />
      </button>

      {visibleError && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute bottom-full right-0 mb-1 flex items-center gap-1 whitespace-nowrap rounded-md bg-(--surface-strong) px-2 py-1 text-xs text-red-600 shadow-sm"
        >
          <AlertCircle size={12} aria-hidden="true" />
          {visibleError}
        </div>
      )}
    </div>
  )
}
