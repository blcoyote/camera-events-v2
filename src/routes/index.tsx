import { createFileRoute, redirect } from '@tanstack/react-router'
import { HomePage } from '#/features/home/components/HomePage'
import type { SessionData } from '#/features/shared/server/session'

export function getHomeRedirect(user: SessionData | null): string | null {
  if (user) return '/camera-events'
  return null
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
    status: typeof search.status === 'string' ? search.status : undefined,
  }),
  beforeLoad: ({ context }) => {
    const redirectPath = getHomeRedirect(context.user)
    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: HomeRoute,
})

function HomeRoute() {
  const { error, status } = Route.useSearch()
  return <HomePage error={error} status={status} />
}
