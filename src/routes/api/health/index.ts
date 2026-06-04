import { createFileRoute } from '@tanstack/react-router'
import { handleLiveness } from '#/features/shared/server/health-handlers'

export const Route = createFileRoute('/api/health/')({
  server: {
    handlers: {
      GET: async () => {
        const result = handleLiveness()
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
