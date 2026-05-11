import { useState, useCallback } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { clearCacheFn } from '#/features/shared/server/frigate/cache-actions'
import { loadCamerasFn } from '#/features/cameras/server/load-cameras'
import { CamerasPage } from '#/features/cameras/components/CamerasPage'
import { CamerasLoading } from '#/features/cameras/components/CamerasLoading'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'

const PULL_THRESHOLD = 80

export const Route = createFileRoute('/_authenticated/cameras')({
  loader: () => loadCamerasFn(),
  pendingComponent: CamerasLoading,
  component: CamerasRoute,
})

function CamerasRoute() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [imgRefreshKey, setImgRefreshKey] = useState(0)

  const onRefresh = useCallback(async () => {
    await clearCacheFn()
    setImgRefreshKey((k) => k + 1)
    await router.invalidate()
  }, [router])

  const { pullDistance, isRefreshing, isComplete } = usePullToRefresh({
    threshold: PULL_THRESHOLD,
    onRefresh,
    disabled: isEditing,
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
      <CamerasPage
        result={result}
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        imgRefreshKey={imgRefreshKey}
      />
    </>
  )
}
