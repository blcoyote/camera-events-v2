import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getEvents } from '#/features/shared/server/frigate/client'
import {
  CameraEventsListPage,
  CameraEventsLoading,
} from '#/features/camera-events/components/CameraEventsListPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { readEventLimit } from '#/features/shared/hooks/useEventLimit'

const loadEvents = createServerFn({ method: 'GET' })
  .inputValidator((data: { limit: number }) => data)
  .handler(
    async ({ data }): Promise<FrigateResult<FrigateEvent[]>> => {
      return getEvents({ limit: data.limit, include_thumbnails: false })
    },
  )

export const Route = createFileRoute('/_authenticated/camera-events/')({
  loader: () => loadEvents({ data: { limit: readEventLimit() } }),
  pendingComponent: CameraEventsLoading,
  component: CameraEventsRoute,
})

function CameraEventsRoute() {
  const result = Route.useLoaderData()
  return <CameraEventsListPage result={result} />
}
