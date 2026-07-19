import { useCallback } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { clearCacheFn } from '#/features/shared/server/frigate/cache-actions'
import { loadLiveCamerasFn } from '#/features/live/server/load-cameras'
import { LivePage } from '#/features/live/pages/LivePage'
import { LiveLoading } from '#/features/live/components/LiveLoading'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'

const PULL_THRESHOLD = 80

export const Route = createFileRoute('/_authenticated/live')({
  loader: () => loadLiveCamerasFn(),
  pendingComponent: LiveLoading,
  component: LiveRoute,
})

function LiveRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()

  const onRefresh = useCallback(async () => {
    clearCacheFn().catch(() => {})
    await router.invalidate()
  }, [router])

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
      <LivePage result={result} />
    </>
  )
}
