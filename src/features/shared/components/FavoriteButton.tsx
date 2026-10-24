import { useEffect, useState } from 'react'
import { Heart, AlertCircle } from 'lucide-react'
import { Button } from '#/features/shared/components/ui/button'
import { Alert } from '#/features/shared/components/ui/alert'

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
      <Button
        type="button"
        variant="ghost"
        size="icon"
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
        className="text-fg-2 hover:bg-transparent hover:text-danger"
      >
        <Heart
          size={20}
          aria-hidden="true"
          className={favorited ? 'fill-danger text-danger' : ''}
        />
      </Button>

      {visibleError && (
        <Alert
          variant="destructive"
          aria-live="assertive"
          className="absolute bottom-full right-0 mb-1 flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs"
        >
          <AlertCircle size={12} aria-hidden="true" />
          {visibleError}
        </Alert>
      )}
    </div>
  )
}
