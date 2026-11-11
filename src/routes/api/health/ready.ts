import { createFileRoute } from '@tanstack/react-router'
import { handleReadiness } from '#/features/shared/server/health-handlers'

export const Route = createFileRoute('/api/health/ready')({
  server: {
    handlers: {
      GET: async () => {
        const result = await handleReadiness()
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
