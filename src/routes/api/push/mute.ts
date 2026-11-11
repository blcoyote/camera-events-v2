import { createFileRoute } from '@tanstack/react-router'
import { getAppSession } from '#/features/shared/server/session'
import {
  handleGetNotificationMute,
  handleSetNotificationMute,
} from '#/features/push-notifications/server/admin-mute-handlers'
import { log } from '#/features/shared/server/log'

export const Route = createFileRoute('/api/push/mute')({
  server: {
    handlers: {
      GET: async () => {
        try {
          let userId: string | null = null
          try {
            const session = await getAppSession()
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          const result = await handleGetNotificationMute(userId)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          log.error('push/mute', 'Unhandled error', err, { method: 'GET' })
          return new Response(JSON.stringify({ error: 'internal_error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      POST: async ({ request }) => {
        try {
          let userId: string | null = null
          try {
            const session = await getAppSession()
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          // Only read the body once a session is present. An unauthenticated
          // (or non-admin) caller is rejected by the handler's 401/403
          // regardless of the body, so parsing it first would be wasted work
          // and needless exposure to a large or slow request body —
          // `undefined` flows through to the same rejection. With a session,
          // a JSON parse failure is still passed through as `undefined`
          // rather than short-circuited here, so a malformed body only ever
          // surfaces as a 400 via the handler's existing 401 -> 403 -> 400
          // order — without duplicating the auth check in the route.
          let body: unknown
          if (userId) {
            try {
              body = await request.json()
            } catch {
              body = undefined
            }
          }

          const result = await handleSetNotificationMute(userId, body)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          log.error('push/mute', 'Unhandled error', err, { method: 'POST' })
          return new Response(JSON.stringify({ error: 'internal_error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
