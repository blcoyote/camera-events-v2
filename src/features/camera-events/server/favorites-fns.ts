import { createServerFn } from '@tanstack/react-start'

export const toggleFavoriteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data }) => {
    const { toggleFavoriteHandler } = await import('./favorites-handlers')
    return toggleFavoriteHandler(data)
  })

export const getUserFavoritedEventIdsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getUserFavoritedEventIdsHandler } =
    await import('./favorites-handlers')
  return getUserFavoritedEventIdsHandler()
})

export const getUserFavoritedEventsFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getUserFavoritedEventsHandler } = await import('./favorites-handlers')
  return getUserFavoritedEventsHandler()
})
