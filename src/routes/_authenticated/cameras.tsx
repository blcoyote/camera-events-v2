import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  getCameras,
  clearCacheFn,
} from '#/features/shared/server/frigate/client'
import {
  CamerasPage,
  CamerasLoading,
} from '#/features/cameras/components/CamerasPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'

const PULL_THRESHOLD = 80

const loadCameras = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<string[]>> => {
    return getCameras()
  },
)

export const Route = createFileRoute('/_authenticated/cameras')({
  loader: () => loadCameras(),
  pendingComponent: CamerasLoading,
  component: CamerasRoute,
})

function CamerasRoute() {
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
      <CamerasPage result={result} />
    </>
  )
}
