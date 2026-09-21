import '@tanstack/react-start/server-only'
import { getUserStore } from '#/features/shared/server/users/user-store'

interface HandlerResult {
  status: number
  body: Record<string, unknown>
}

/**
 * Re-reads `is_admin` from the store on every call — the same rule every
 * other consumer follows (see docs/specs/admin-global-notification-mute.md):
 * never trust a session-carried claim. Unlike the mute endpoint, there is no
 * sensitive state to protect here, so a signed-in non-admin gets a normal
 * `200 { isAdmin: false }` rather than a 403.
 */
export async function handleGetAdminStatus(
  userId: string | null,
): Promise<HandlerResult> {
  if (!userId) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  const isAdmin = (await getUserStore()).isAdmin(userId)
  return { status: 200, body: { isAdmin } }
}
