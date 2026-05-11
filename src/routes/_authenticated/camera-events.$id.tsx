import { createFileRoute } from '@tanstack/react-router'
import { loadEventFn } from '#/features/camera-details/server/load-event'
import { CameraEventDetailPage } from '#/features/camera-details/components/CameraEventDetailPage'
import { getUserFavoritedEventIdsFn } from '#/features/shared/server/favorites/favorites-fns'

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
  return (
    <CameraEventDetailPage
      result={result}
      initialFavorited={favoritedEventIds.includes(
        result.ok ? result.data.id : '',
      )}
    />
  )
}
