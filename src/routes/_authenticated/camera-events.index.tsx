import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import {
  getEvents,
  clearCacheFn,
} from '#/features/shared/server/frigate/client'
import {
  CameraEventsListPage,
  CameraEventsLoading,
} from '#/features/camera-events/components/CameraEventsListPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { readEventLimitFromCookies } from '#/features/shared/hooks/useEventLimit'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'

const PULL_THRESHOLD = 80

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
  const router = useRouter()
  const onRefresh = async () => {
    await clearCacheFn()
    await router.invalidate()
  }

  const { pullDistance, isRefreshing, isComplete } = usePullToRefresh({
    threshold: PULL_THRESHOLD,
    onRefresh,
  })

  useRefetchOnFocus({ onRefresh })

  return (
    <>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        isComplete={isComplete}
        threshold={PULL_THRESHOLD}
      />
      <CameraEventsListPage result={result} />
    </>
  )
}
