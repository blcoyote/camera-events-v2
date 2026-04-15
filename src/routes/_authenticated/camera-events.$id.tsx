import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getEvent } from '#/features/shared/server/frigate/client'
import { CameraEventDetailPage } from '#/features/camera-events/components/CameraEventDetailPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

const loadEvent = createServerFn({ method: 'GET' })
  .inputValidator((data: string) => data)
  .handler(async ({ data: eventId }): Promise<FrigateResult<FrigateEvent>> => {
    return getEvent(eventId)
  })

export const Route = createFileRoute('/_authenticated/camera-events/$id')({
  loader: ({ params }) => loadEvent({ data: params.id }),
  component: CameraEventDetailRoute,
})

function CameraEventDetailRoute() {
  const result = Route.useLoaderData()
  return <CameraEventDetailPage result={result} />
}
