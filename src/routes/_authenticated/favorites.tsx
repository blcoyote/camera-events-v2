import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '#/features/favorites/pages/FavoritesPage'
import { FavoritesLoading } from '#/features/favorites/components/FavoritesLoading'
import { getFavoritesPageFn } from '#/features/shared/server/favorites/favorites-fns'
import type { FavoriteEntry } from '#/features/shared/server/favorites/types'

export async function favoritesLoader(): Promise<FavoriteEntry[]> {
  return getFavoritesPageFn().catch((): FavoriteEntry[] => [])
}

export const Route = createFileRoute('/_authenticated/favorites')({
  loader: favoritesLoader,
  pendingComponent: FavoritesLoading,
  component: FavoritesRoute,
})

function FavoritesRoute() {
  const entries = Route.useLoaderData()
  return <FavoritesPage entries={entries} />
}
