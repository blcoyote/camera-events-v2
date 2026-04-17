import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { getEvents } from '#/features/shared/server/frigate/client'
import {
  CameraEventsListPage,
  CameraEventsLoading,
} from '#/features/camera-events/components/CameraEventsListPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { readEventLimitFromCookies } from '#/features/shared/hooks/useEventLimit'

const loadEvents = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<FrigateEvent[]>> => {
    const cookies = getRequestHeader('cookie') ?? ''
    const limit = readEventLimitFromCookies(cookies)
    return getEvents({ limit, include_thumbnails: false })
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
