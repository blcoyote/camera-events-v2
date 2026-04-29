import { createFileRoute } from '@tanstack/react-router'
import { getMetricsText } from '#/features/shared/server/metrics'

export const Route = createFileRoute('/api/metrics')({
  server: {
    handlers: {
      GET: async () => {
        const body = await getMetricsText()
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          },
        })
      },
    },
  },
})
