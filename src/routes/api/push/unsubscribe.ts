import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/server/session'
import type { SessionData } from '#/server/session'
import { handleUnsubscribe } from './-push-handlers'

export const Route = createFileRoute('/api/push/unsubscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let userId: string | null = null
        try {
          const session = await useSession<SessionData>(getSessionConfig())
          userId = session.data.sub || null
        } catch {
          // Corrupted session
        }

        let body: any
        try {
          body = await request.json()
        } catch {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const result = await handleUnsubscribe(userId, body)
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
