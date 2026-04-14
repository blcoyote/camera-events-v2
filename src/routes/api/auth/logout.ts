import { createFileRoute } from '@tanstack/react-router'
import { clearSession } from '@tanstack/react-start/server'
import { getSessionConfig } from '#/server/session'
import { redirectTo } from '#/server/auth'

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
