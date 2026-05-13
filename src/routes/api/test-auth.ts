import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'

export const Route = createFileRoute('/api/test-auth')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const nodeEnv = process.env.NODE_ENV
        const isAllowedEnv = nodeEnv === 'development' || nodeEnv === 'test'

        const e2eToken = process.env.E2E_AUTH_TOKEN
        const providedToken = request.headers.get('X-E2E-Auth-Token')
        const hasValidToken = !!e2eToken && providedToken === e2eToken

        if (!isAllowedEnv || !hasValidToken) {
          return new Response('Forbidden', { status: 403 })
        }
        const url = new URL(request.url)
        const raw = url.searchParams.get('redirect') ?? '/cameras'
        // Only allow internal paths — reject protocol-relative URLs and external hosts
        const redirect =
          raw.startsWith('/') && !raw.startsWith('//') ? raw : '/cameras'
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
