import { createFileRoute } from '@tanstack/react-router'
import { handleVapidPublicKey } from '#/features/push-notifications/server/push-handlers'

export const Route = createFileRoute('/api/push/vapid-public-key')({
  server: {
    handlers: {
      GET: async () => {
        const result = handleVapidPublicKey()
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
