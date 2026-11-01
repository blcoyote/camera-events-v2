import { createFileRoute } from '@tanstack/react-router'
import { getAppSession } from '#/features/shared/server/session'
import { handleShareEvent } from '#/features/push-notifications/server/share-handlers'

export const Route = createFileRoute('/api/events/$id/share')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          let userId: string | null = null
          try {
            const session = await getAppSession()
            userId = session.data.sub || null
          } catch {
            // Corrupted session
          }

          const body: unknown = await request.json().catch(() => undefined)
          const result = await handleShareEvent(userId, params.id, body)
          if (result.status === 204) return new Response(null, { status: 204 })
          return new Response(JSON.stringify(result.body), {
            status: result.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err) {
          console.error('[events/share] Unhandled error:', err)
          return new Response(JSON.stringify({ error: 'internal_error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
