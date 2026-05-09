import { useState, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toggleFavoriteFn } from '../server/favorites-fns'

const TOGGLE_ERROR_MESSAGE = 'Could not save favorite. Please try again.'

export function useFavoriteToggle(eventId: string, initialFavorited: boolean) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(async () => {
    if (pending) return

    const prev = favorited
    setPending(true)

    try {
      const result = await toggleFavoriteFn({ data: { eventId } })
      setFavorited(result.favorited)
      await router.invalidate()
    } catch {
      setFavorited(prev)
      setError(TOGGLE_ERROR_MESSAGE)
    } finally {
      setPending(false)
    }
  }, [eventId, favorited, pending, router])

  return { favorited, pending, error, toggle }
}
