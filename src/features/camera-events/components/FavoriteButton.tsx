import { useState, useRef, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { toggleFavoriteFn } from '../server/favorites'

export function FavoriteButton({
  eventId,
  eventLabel,
  isFavorited,
  className = '',
}: {
  eventId: string
  eventLabel?: string
  isFavorited: boolean
  className?: string
}) {
  const [favorited, setFavorited] = useState(isFavorited)
  const [errorMsg, setErrorMsg] = useState('')
  const isPending = useRef(false)
  const label = eventLabel ? `Favorite ${eventLabel}` : 'Favorite this event'

  useEffect(() => {
    if (!isPending.current) {
      setFavorited(isFavorited)
    }
  }, [isFavorited])

  async function handleClick() {
    if (isPending.current) return
    isPending.current = true
    const previous = favorited
    setFavorited(!previous)
    setErrorMsg('')
    try {
      const result = await toggleFavoriteFn({ data: eventId })
      if (!result.ok) {
        setFavorited(previous)
        setErrorMsg('Could not update favorite. Please try again.')
      } else {
        setFavorited(result.isFavorited)
      }
    } catch {
      setFavorited(previous)
      setErrorMsg('Could not update favorite. Please try again.')
    } finally {
      isPending.current = false
    }
  }

  return (
    <div className="contents">
      <button
        type="button"
        aria-label={label}
        aria-pressed={favorited}
        className={`flex min-h-6 min-w-8 shrink- items-center justify-center rounded-full transition ${favorited ? 'text-red-500' : 'text-(--sea-ink-soft) hover:text-red-500'} ${className}`}
        onClick={handleClick}
      >
        <Heart
          size={16}
          aria-hidden="true"
          fill={favorited ? 'currentColor' : 'none'}
        />
      </button>
      <span className="sr-only" role="status">
        {errorMsg}
      </span>
    </div>
  )
}
