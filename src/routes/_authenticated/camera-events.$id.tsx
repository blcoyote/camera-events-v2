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
    // Stamped here rather than read during render so the server and the client
    // agree on the event's age at first paint. The detail page uses it to tell
    // "Frigate hasn't written this event yet" from "this event is gone".
    return { result, favoritedEventIds, loadedAt: Date.now() }
  },
  component: CameraEventDetailRoute,
})

function CameraEventDetailRoute() {
  const { result, favoritedEventIds, loadedAt } = Route.useLoaderData()
  const { id } = Route.useParams()
  const router = useRouter()

  const onRefresh = async () => {
    await router.invalidate()
  }

  useRefetchOnMount({ onRefresh })
  useRefetchOnFocus({ onRefresh })

  return (
    <CameraEventDetailPage
      result={result}
      eventId={id}
      nowMs={loadedAt}
      onRetry={onRefresh}
      initialFavorited={favoritedEventIds.includes(
        result.ok ? result.data.id : '',
      )}
    />
  )
}
