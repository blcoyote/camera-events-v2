import '@tanstack/react-start/server-only'
import { createDelivery } from './delivery'
import type { Delivery } from './delivery'
import { readBodyField } from './request-body'
import { formatCameraName } from './push-notify'
import { m } from '#/paraglide/messages.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { getEvent } from '#/features/shared/server/frigate/client'
import { isValidEventId } from '#/features/shared/server/frigate/validation'
import { getFavoritesStore } from '#/features/shared/server/favorites/favorites-store'
import { retainIfFirst } from '#/features/shared/server/favorites/favorites-handlers'
import { getUserStore } from '#/features/shared/server/users/user-store'

const MAX_RECIPIENTS = 50
const defaultDelivery = createDelivery()

interface Result {
  status: number
  body?: Record<string, unknown>
}

const fail = (status: number, error: string): Result => ({
  status,
  body: { error },
})

export async function handleShareEvent(
  userId: string | null,
  eventId: string,
  body: unknown,
  options: { delivery?: Delivery } = {},
): Promise<Result> {
  if (!userId) return fail(401, 'unauthorized')
  if (!isValidEventId(eventId)) return fail(400, 'invalid_event_id')

  const raw = readBodyField(body, 'recipientIds')
  if (
    !Array.isArray(raw) ||
    raw.length < 1 ||
    raw.length > MAX_RECIPIENTS ||
    !raw.every((r) => typeof r === 'string')
  ) {
    return fail(400, 'invalid_body')
  }
  const recipients = new Set<string>(raw as string[])
  recipients.delete(userId)
  if (recipients.size === 0) return fail(400, 'invalid_body')

  const users = await getUserStore()
  for (const id of recipients) {
    if (!users.getUser(id)) return fail(400, 'unknown_recipient')
  }

  const found = await getEvent(eventId)
  if (!found.ok) return fail(404, 'not_found')
  const event = found.data

  const store = await getFavoritesStore()
  for (const id of recipients) {
    store.addShare(eventId, userId, id)
    // Per recipient: the count is 1 only right after the first-ever reference.
    await retainIfFirst(store, eventId)
  }

  const sender = users.getUser(userId)
  const senderName = (locale: 'en' | 'da') =>
    sender?.first_name ||
    sender?.email ||
    m.shared_share_someone({}, { locale })

  await (options.delivery ?? defaultDelivery).deliver({
    logTag: 'share',
    description: `Share of event ${eventId} to ${recipients.size} user(s)`,
    ignoreMute: true,
    isUserEligible: (id) => recipients.has(id),
    buildPayload: (_burstStart, locale) => ({
      title: m.push_share_title({ name: senderName(locale) }, { locale }),
      body: m.push_share_body(
        {
          label: translateLabel(event.label, locale),
          camera: formatCameraName(event.camera),
        },
        { locale },
      ),
      url: `/camera-events/${eventId}`,
      icon: '/icon-192.png',
      tag: `share:${eventId}`,
      locale,
    }),
  })
  return { status: 204 }
}
