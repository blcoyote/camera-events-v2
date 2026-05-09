import { createFileRoute, useRouter } from '@tanstack/react-router'
import { clearCacheFn } from '#/features/shared/server/frigate/client'
import { FavoritesListPage } from '#/features/camera-events/components/FavoritesListPage'
import { CameraEventsLoading } from '#/features/camera-events/components/CameraEventsListPage'
import {
  getFavoriteEventsFn,
  getFavoritedEventIdsFn,
} from '#/features/camera-events/server/favorites'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { useRefetchOnMount } from '#/features/shared/hooks/useRefetchOnMount'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'

const PULL_THRESHOLD = 80

export const Route = createFileRoute('/_authenticated/favorites')({
  loader: async () => {
    const [events, favoriteEventIds] = await Promise.all([
      getFavoriteEventsFn(),
      getFavoritedEventIdsFn(),
    ])
    return { events, favoriteEventIds }
  },
  pendingComponent: CameraEventsLoading,
  component: FavoritesRoute,
})

function FavoritesRoute() {
  const { events, favoriteEventIds } = Route.useLoaderData()
  const router = useRouter()
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
      <FavoritesListPage events={events} favoriteEventIds={favoriteEventIds} />
    </>
  )
}
