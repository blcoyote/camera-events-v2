import { createServerFn } from '@tanstack/react-start'

export const toggleFavoriteFn = createServerFn({ method: 'POST' })
  .validator((data: { eventId: string }) => data)
  .handler(async ({ data }) => {
    const { toggleFavoriteHandler } = await import('./favorites-handlers')
    return toggleFavoriteHandler(data)
  })

export const getUserFavoritedEventIdsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getUserFavoritedEventIdsHandler } = await import(
    './favorites-handlers'
  )
  return getUserFavoritedEventIdsHandler()
})

export const getFavoritesPageFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getFavoritesPageHandler } = await import('./favorites-handlers')
  return getFavoritesPageHandler()
})
