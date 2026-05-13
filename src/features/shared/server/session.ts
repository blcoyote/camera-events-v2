import '@tanstack/react-start/server-only'
import type { SessionConfig } from '@tanstack/react-start/server'
import { useSession } from '@tanstack/react-start/server'

export type SessionData = {
  /** Google OpenID Connect subject identifier (unique per user) */
  sub: string
  firstName: string
  email: string
  avatarUrl: string
}

/**
 * Base session config — password is added lazily at call time
 * to avoid module-scope env access.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-google-sso' : 'google-sso'
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60 // 7 days

export const SESSION_CONFIG_BASE = {
  name: SESSION_COOKIE_NAME,
  maxAge: SESSION_MAX_AGE_SECONDS,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  },
}

export function getSessionConfig(): SessionConfig {
  const password = process.env.SESSION_SECRET
  if (!password || password.length < 32) {
    throw new Error(
      'SESSION_SECRET environment variable is required and must be at least 32 characters',
    )
  }
  return {
    ...SESSION_CONFIG_BASE,
    password,
  }
}

/**
 * Require an authenticated session. Returns the user's subject ID.
 * Throws if the session is missing, corrupted, or unauthenticated.
 *
 * Use this inside createServerFn handlers — route-level layout guards
 * only protect client-side navigation, not direct server function calls.
 */
export async function requireSession(): Promise<string> {
  const session = await useSession<SessionData>(getSessionConfig())
  if (!session.data.sub) {
    throw new Error('Unauthorized')
  }
  return session.data.sub
}
