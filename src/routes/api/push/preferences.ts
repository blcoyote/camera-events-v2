import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'
import { handleGetPreferences, handleSetPreference } from '#/features/push-notifications/server/push-handlers'

export const Route = createFileRoute('/api/push/preferences')({
  server: {
    handlers: {
      GET: async () => {
        let userId: string | null = null
        try {
          const session = await useSession<SessionData>(getSessionConfig())
          userId = session.data.sub || null
        } catch {
          // Corrupted session
        }

        const result = await handleGetPreferences(userId)
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },

      PUT: async ({ request }) => {
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

        const result = await handleSetPreference(userId, body)
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
