import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'

export const Route = createFileRoute('/api/test-auth')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (process.env.E2E_TEST !== 'true') {
          return new Response('Forbidden', { status: 403 })
        }
        const url = new URL(request.url)
        const redirect = url.searchParams.get('redirect') ?? '/cameras'
        const session = await useSession(getSessionConfig())
        await session.update({
          sub: 'test-e2e-user',
          firstName: 'Test',
          email: 'test@e2e.local',
          avatarUrl: '',
        })
        return new Response(null, {
          status: 302,
          headers: { Location: redirect },
        })
      },
    },
  },
})
