import { createServerFn } from '@tanstack/react-start'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'

export type ToggleFavoriteResult = { ok: boolean; error?: string }

export function handleToggleFavorite(
  eventId: string,
  userId: string,
): ToggleFavoriteResult {
  if (!isValidEventId(eventId)) {
    return { ok: false, error: 'Invalid event ID' }
  }
  void userId
  return { ok: true }
}

export const toggleFavoriteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: string) => data)
  .handler(async ({ data: eventId }) => {
    const userId = await requireSession()
    return handleToggleFavorite(eventId, userId)
  })
