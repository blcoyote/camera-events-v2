import { createFileRoute, useRouter } from '@tanstack/react-router'
import { clearCacheFn } from '#/features/shared/server/frigate/cache-actions'
import { loadEventsFn } from '#/features/camera-events/server/load-events'
import { CameraEventsListPage } from '#/features/camera-events/pages/CameraEventsListPage'
import { CameraEventsLoading } from '#/features/camera-events/components/CameraEventsLoading'
import { usePullToRefresh } from '#/features/shared/hooks/usePullToRefresh'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'
import { useRefetchOnMount } from '#/features/shared/hooks/useRefetchOnMount'
import { PullToRefreshIndicator } from '#/features/shared/components/PullToRefreshIndicator'
import { getUserFavoritedEventIdsFn } from '#/features/shared/server/favorites/favorites-fns'

const PULL_THRESHOLD = 80

export async function cameraEventsLoader() {
  const [result, favoritedEventIds] = await Promise.all([
    loadEventsFn(),
    getUserFavoritedEventIdsFn().catch((): string[] => []),
  ])
  return { result, favoritedEventIds }
}

// Filters only narrow already-loaded events client-side; never sent to Frigate.
export function validateCameraEventsSearch(s: Record<string, unknown>): {
  type?: string
  camera?: string
} {
  const str = (v: unknown) =>
    typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : undefined
  return { type: str(s.type), camera: str(s.camera) }
}

export const Route = createFileRoute('/_authenticated/camera-events/')({
  validateSearch: validateCameraEventsSearch,
  loader: cameraEventsLoader,
  pendingComponent: CameraEventsLoading,
  component: CameraEventsRoute,
})

function CameraEventsRoute() {
  const { result, favoritedEventIds } = Route.useLoaderData()
  const router = useRouter()
  const { type, camera } = Route.useSearch()
  const navigate = Route.useNavigate()
  const setFilter = (key: 'type' | 'camera') => (v: string | null) =>
    navigate({
      search: (prev) => ({ ...prev, [key]: v ?? undefined }),
      replace: true,
      resetScroll: false,
    })
  const favoritedIds = new Set<string>(favoritedEventIds)

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
      <CameraEventsListPage
        result={result}
        favoritedIds={favoritedIds}
        labelFilter={type ?? null}
        cameraFilter={camera ?? null}
        onLabelFilterChange={setFilter('type')}
        onCameraFilterChange={setFilter('camera')}
      />
    </>
  )
}
