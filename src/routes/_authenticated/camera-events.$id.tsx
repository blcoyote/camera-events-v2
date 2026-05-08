import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getEvent } from '#/features/shared/server/frigate/client'
import { CameraEventDetailPage } from '#/features/camera-events/components/CameraEventDetailPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { requireSession } from '#/features/shared/server/session'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getIsFavoritedFn } from '#/features/camera-events/server/favorites'

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
    const fallback = {
      ok: false as const,
      isFavorited: false as const,
      error: '',
    }
    const [result, favoritedResult] = await Promise.all([
      loadEvent({ data: params.id }),
      getIsFavoritedFn({ data: params.id }).catch((err: unknown) => {
        console.warn('[camera-events] getIsFavorited failed:', err)
        return fallback
      }),
    ])
    if (!favoritedResult.ok && favoritedResult.error) {
      console.warn(
        '[camera-events] getIsFavorited returned error:',
        favoritedResult.error,
      )
    }
    const isFavorited = favoritedResult.ok ? favoritedResult.isFavorited : false
    return { result, isFavorited }
  },
  component: CameraEventDetailRoute,
})

function CameraEventDetailRoute() {
  const { result, isFavorited } = Route.useLoaderData()
  return <CameraEventDetailPage result={result} isFavorited={isFavorited} />
}
