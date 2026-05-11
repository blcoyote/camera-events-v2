import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '#/features/favorites/components/FavoritesPage'
import { FavoritesLoading } from '#/features/favorites/components/FavoritesLoading'
import { getUserFavoritedEventsFn } from '#/features/shared/server/favorites/favorites-fns'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'

export async function favoritesLoader(): Promise<FrigateEvent[]> {
  return getUserFavoritedEventsFn().catch((): FrigateEvent[] => [])
}

export const Route = createFileRoute('/_authenticated/favorites')({
  loader: favoritesLoader,
  pendingComponent: FavoritesLoading,
  component: FavoritesRoute,
})

function FavoritesRoute() {
  const events = Route.useLoaderData()
  return <FavoritesPage events={events} />
}
