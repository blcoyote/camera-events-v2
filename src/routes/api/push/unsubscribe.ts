import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import {
  getSessionConfig,
  SESSION_COOKIE_NAME,
} from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleUnsubscribe } from '#/features/push-notifications/server/push-handlers'

export const Route = createFileRoute('/api/push/unsubscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cookieHeader = request.headers.get('cookie') ?? ''
          let userId: string | null = null
          if (
            cookieHeader
              .split(';')
              .some((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`))
          ) {
            try {
              const session = await useSession<SessionData>(getSessionConfig())
              userId = session.data.sub || null
            } catch {
              // Corrupted session
            }
          }

          let body: any
          try {
            body = await request.json()
          } catch {
            return new Response(
              JSON.stringify({ error: 'Invalid JSON body' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const result = await handleUnsubscribe(userId, body)
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[push/unsubscribe] Unhandled error:', err)
          return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      },
    },
  },
})
