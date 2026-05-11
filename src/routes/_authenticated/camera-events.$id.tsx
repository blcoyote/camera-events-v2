import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getEvent } from '#/features/shared/server/frigate/client'
import { CameraEventDetailPage } from '#/features/camera-events/components/CameraEventDetailPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getUserFavoritedEventIdsFn } from '#/features/shared/server/favorites/favorites-fns'

const loadEvent = createServerFn({ method: 'GET' })
  .inputValidator((data: string) => data)
  .handler(async ({ data: eventId }): Promise<FrigateResult<FrigateEvent>> => {
    await requireSession()
    if (!isValidEventId(eventId)) {
      return { ok: false, error: 'Invalid event ID' }
    }
    return getEvent(eventId)
  })

export const Route = createFileRoute('/_authenticated/camera-events/$id')({
  loader: async ({ params }) => {
    const [result, favoritedEventIds] = await Promise.all([
      loadEvent({ data: params.id }),
      getUserFavoritedEventIdsFn().catch((): string[] => []),
    ])
    return { result, favoritedEventIds }
  },
  component: CameraEventDetailRoute,
})

function CameraEventDetailRoute() {
  const { result, favoritedEventIds } = Route.useLoaderData()
  return (
    <CameraEventDetailPage
      result={result}
      initialFavorited={favoritedEventIds.includes(
        result.ok ? result.data.id : '',
      )}
    />
  )
}
