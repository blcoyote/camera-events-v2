import { createFileRoute, useRouter } from '@tanstack/react-router'
import { clearCacheFn } from '#/features/shared/server/frigate/cache-actions'
import { loadDashboardFn } from '#/features/dashboard/server/dashboard-fns'
import { DashboardPage } from '#/features/dashboard/pages/DashboardPage'
import { DashboardLoading } from '#/features/dashboard/components/DashboardLoading'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { useRefetchOnMount } from '#/features/shared/hooks/useRefetchOnMount'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'

const PULL_THRESHOLD = 80

export const Route = createFileRoute('/_authenticated/dashboard')({
  loader: () => loadDashboardFn(),
  pendingComponent: DashboardLoading,
  component: DashboardRoute,
})

function DashboardRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()

  const onRefresh = async () => {
    clearCacheFn().catch(() => {})
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
      <DashboardPage result={result} />
    </>
  )
}
