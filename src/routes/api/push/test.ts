import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/server/session'
import type { SessionData } from '#/server/session'
import { handleTest } from './-push-handlers'

export const Route = createFileRoute('/api/push/test')({
  server: {
    handlers: {
      POST: async () => {
        let userId: string | null = null
        try {
          const session = await useSession<SessionData>(getSessionConfig())
          userId = session.data.sub || null
        } catch {
          // Corrupted session
        }

        const result = await handleTest(userId)
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
