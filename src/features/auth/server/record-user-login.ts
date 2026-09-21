import type { UserStore } from '#/features/shared/server/users/user-store'
import { parseAdminEmails, isAdminEmail } from './admin-emails'

/**
 * Record a login and seed admin status from ADMIN_EMAILS. Fail-closed and
 * never-demote: a matching email promotes the user, but a non-matching one
 * never lowers an existing admin flag. A malformed (empty) `sub` is dropped
 * entirely rather than creating a junk row.
 */
export function recordUserLogin(
  store: UserStore,
  user: { sub: string; email: string; firstName: string; avatarUrl: string },
  adminEmailsRaw: string | undefined,
): void {
  if (!user.sub.trim()) return

  store.upsertUser(user)

  if (isAdminEmail(user.email, parseAdminEmails(adminEmailsRaw))) {
    store.promoteToAdmin(user.sub)
  }
}
