import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { readEventLimitFromCookies } from '#/features/shared/hooks/useEventLimit'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

export const loadEventsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<FrigateEvent[]>> => {
    const { requireSession } = await import('#/features/shared/server/session')
    const { getEvents } =
      await import('#/features/shared/server/frigate/client')
    await requireSession()
    const cookies = getRequestHeader('cookie') ?? ''
    const limit = readEventLimitFromCookies(cookies)
    return getEvents({ limit, include_thumbnails: false })
  },
)
