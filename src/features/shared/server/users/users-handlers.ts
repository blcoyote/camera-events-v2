import '@tanstack/react-start/server-only'
import { requireSession } from '#/features/shared/server/session'
import { getUserStore } from './user-store'
import type { ShareRecipient } from './types'

export type { ShareRecipient }

/** Users the caller can share an event with (everyone but the caller). */
export async function getShareRecipientsHandler(): Promise<ShareRecipient[]> {
  const userId = await requireSession()
  const store = await getUserStore()
  return store
    .listUsers()
    .filter((u) => u.sub !== userId)
    .map((u) => ({
      sub: u.sub,
      displayName: u.firstName || u.email,
      avatarUrl: u.avatarUrl,
    }))
}
