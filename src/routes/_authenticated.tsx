import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import type { SessionData } from '#/features/shared/server/session'

/**
 * Pure function: determine redirect path for unauthenticated users.
 * Returns null if user is authenticated (no redirect needed).
 */
export function getAuthRedirect(
  user: SessionData | null,
  currentPath: string,
): string | null {
  if (user) return null
  return `/?returnTo=${encodeURIComponent(currentPath)}`
}

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    const redirectPath = getAuthRedirect(context.user, location.pathname)
    if (redirectPath) {
      throw redirect({ href: redirectPath })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return <Outlet />
}
