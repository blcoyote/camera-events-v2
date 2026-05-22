import { createFileRoute, useRouter } from '@tanstack/react-router'
import { loadEventFn } from '#/features/camera-details/server/load-event'
import { CameraEventDetailPage } from '#/features/camera-details/pages/CameraEventDetailPage'
import { getUserFavoritedEventIdsFn } from '#/features/shared/server/favorites/favorites-fns'
import { useRefetchOnMount } from '#/features/shared/hooks/useRefetchOnMount'
import { useRefetchOnFocus } from '#/features/shared/hooks/useRefetchOnFocus'

export const Route = createFileRoute('/_authenticated/camera-events/$id')({
  loader: async ({ params }) => {
    const [result, favoritedEventIds] = await Promise.all([
      loadEventFn({ data: params.id }),
      getUserFavoritedEventIdsFn().catch((): string[] => []),
    ])
    return { result, favoritedEventIds }
  },
  component: CameraEventDetailRoute,
})

function CameraEventDetailRoute() {
  const { result, favoritedEventIds } = Route.useLoaderData()
  const router = useRouter()

  const onRefresh = async () => {
    await router.invalidate()
  }

  useRefetchOnMount({ onRefresh })
  useRefetchOnFocus({ onRefresh })

  return (
    <CameraEventDetailPage
      result={result}
      initialFavorited={favoritedEventIds.includes(
        result.ok ? result.data.id : '',
      )}
    />
  )
}
