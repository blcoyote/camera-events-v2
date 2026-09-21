import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import {
  handleGetNotificationMute,
  handleMuteAllNotifications,
} from '#/features/push-notifications/server/admin-mute-handlers'

export const Route = createFileRoute('/api/push/mute')({
  server: {
    handlers: {
      GET: async () => {
        try {
          let userId: string | null = null
          try {
            const session = await useSession<SessionData>(getSessionConfig())
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
          console.error('[push/mute GET] Unhandled error:', err)
          const message =
            err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      POST: async () => {
        try {
          let userId: string | null = null
          try {
            const session = await useSession<SessionData>(getSessionConfig())
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          const result = await handleMuteAllNotifications(userId)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[push/mute POST] Unhandled error:', err)
          const message =
            err instanceof Error ? err.message : 'Internal server error'
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
