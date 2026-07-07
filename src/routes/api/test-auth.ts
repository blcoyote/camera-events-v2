import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import { isTestAuthEnabled } from '#/features/auth/server/test-auth-guard'

export const Route = createFileRoute('/api/test-auth')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Build-time gate: `import.meta.env.DEV` is statically `false` in
        // production builds, so the session-minting code below is unreachable
        // dead code in prod and cannot be re-enabled by any runtime env var
        // (NODE_ENV / E2E_TEST). Reachable only in a dev server started with
        // E2E_TEST=true (see playwright.config.ts).
        if (!(import.meta.env.DEV && isTestAuthEnabled(process.env.E2E_TEST))) {
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
