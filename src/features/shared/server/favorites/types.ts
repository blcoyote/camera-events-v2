import type { FrigateEvent } from '#/features/shared/server/frigate/types'

export type FavoriteEntry = {
  event: FrigateEvent
  favorited: boolean
  /** Sender display names, oldest share first; null when the sender is unknown. */
  sharedBy: (string | null)[]
}
