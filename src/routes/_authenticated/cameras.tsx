import { useState, useCallback } from 'react'
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
  const [refreshKey, setRefreshKey] = useState(0)
  const onRefresh = useCallback(async () => {
    await clearCacheFn()
    await router.invalidate()
    setRefreshKey((k) => k + 1)
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
      <CamerasPage result={result} refreshKey={refreshKey} />
    </>
  )
}
