import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import {
  getEvents,
  clearCacheFn,
} from '#/features/shared/server/frigate/client'
import { CameraEventsListPage } from '#/features/camera-events/components/CameraEventsListPage'
import { CameraEventsLoading } from '#/features/camera-events/components/CameraEventsLoading'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { requireSession } from '#/features/shared/server/session'
import { readEventLimitFromCookies } from '#/features/shared/hooks/useEventLimit'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { useRefetchOnMount } from '#/features/shared/hooks/useRefetchOnMount'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'
import { getUserFavoritedEventIdsFn } from '#/features/camera-events/server/favorites-fns'

const PULL_THRESHOLD = 80

const loadEvents = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<FrigateEvent[]>> => {
    await requireSession()
    const cookies = getRequestHeader('cookie') ?? ''
    const limit = readEventLimitFromCookies(cookies)
    return getEvents({ limit, include_thumbnails: false })
  },
)

export async function cameraEventsLoader() {
  const [result, favoritedEventIds] = await Promise.all([
    loadEvents(),
    getUserFavoritedEventIdsFn().catch((): string[] => []),
  ])
  return { result, favoritedEventIds }
}

export const Route = createFileRoute('/_authenticated/camera-events/')({
  loader: cameraEventsLoader,
  pendingComponent: CameraEventsLoading,
  component: CameraEventsRoute,
})

function CameraEventsRoute() {
  const { result, favoritedEventIds } = Route.useLoaderData()
  const router = useRouter()
  const favoritedIds = new Set<string>(favoritedEventIds)

  const onRefresh = async () => {
    await clearCacheFn()
    await router.invalidate()
  }

  const { pullDistance, isRefreshing, isComplete } = usePullToRefresh({
    threshold: PULL_THRESHOLD,
    onRefresh,
  })

  useRefetchOnMount({ onRefresh })
  useRefetchOnFocus({ onRefresh })

  return (
    <>
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        isComplete={isComplete}
        threshold={PULL_THRESHOLD}
      />
      <CameraEventsListPage result={result} favoritedIds={favoritedIds} />
    </>
  )
}
