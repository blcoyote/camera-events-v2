import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getEvent } from '#/server/frigate/client'
import { CameraEventDetailPage } from '#/pages/camera-events/CameraEventDetailPage'
import type { FrigateResult } from '#/server/frigate/config'
import type { FrigateEvent } from '#/server/frigate/types'

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
