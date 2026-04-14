import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getEvents } from '#/server/frigate/client'
import {
  CameraEventsListPage,
  CameraEventsLoading,
} from '#/pages/camera-events/CameraEventsListPage'
import type { FrigateResult } from '#/server/frigate/config'
import type { FrigateEvent } from '#/server/frigate/types'

const loadEvents = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<FrigateEvent[]>> => {
    return getEvents({ limit: 50, include_thumbnails: false })
  },
)

export const Route = createFileRoute('/_authenticated/camera-events/')({
  loader: () => loadEvents(),
  pendingComponent: CameraEventsLoading,
  component: CameraEventsRoute,
})

function CameraEventsRoute() {
  const result = Route.useLoaderData()
  return <CameraEventsListPage result={result} />
}
