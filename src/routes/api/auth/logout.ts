import { createFileRoute } from '@tanstack/react-router'
import { clearSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/features/shared/server/session'
import { redirectTo } from '#/features/auth/server/auth'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        try {
          await clearSession(getSessionConfig())
        } catch {
          // Session may not exist — that's fine
        }
        return redirectTo('/?status=logged_out')
      },
    },
  },
})
