import { createServerFn } from '@tanstack/react-start'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

export const loadEventFn = createServerFn({ method: 'GET' })
  .validator((data: string) => data)
  .handler(async ({ data: eventId }): Promise<FrigateResult<FrigateEvent>> => {
    const { requireSession } = await import('#/features/shared/server/session')
    const { isValidEventId } =
      await import('#/features/shared/server/frigate/validation')
    const { getEvent } = await import('#/features/shared/server/frigate/client')
    await requireSession()
    if (!isValidEventId(eventId)) {
      return { ok: false, error: 'Invalid event ID' }
    }
    return getEvent(eventId)
  })
