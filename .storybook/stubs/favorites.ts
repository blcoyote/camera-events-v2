export const toggleFavoriteFn = async (_: { data: string }) => ({
  ok: true as const,
  isFavorited: false,
})

export const getFavoritedEventIdsFn = async () => [] as string[]

export const getIsFavoritedFn = async (_: { data: string }) => ({
  ok: true as const,
  isFavorited: false,
})

export const getFavoriteEventsFn = async () => [] as never[]
