import '@tanstack/react-start/server-only'
import type { SessionConfig } from '@tanstack/react-start/server'
import { useSession } from '@tanstack/react-start/server'
import { mockEvent, unsealSession } from 'h3-v2'

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
export const SESSION_COOKIE_NAME = 'google-sso'
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

/**
 * Resolve whether the incoming request has an authenticated session,
 * coercing missing or corrupted sessions to `false`. Used by media proxy
 * route handlers (clip, snapshot, thumbnail) that hand the boolean to a
 * pure proxy function for authorization. Never throws.
 */
export async function resolveIsAuthenticated(): Promise<boolean> {
  try {
    const session = await useSession<SessionData>(getSessionConfig())
    return !!session.data.sub
  } catch {
    return false
  }
}

/**
 * Reads a single named cookie's raw value out of a `Cookie` request header,
 * without relying on any request-scoped framework state. Cookie values are
 * percent-encoded by the same `cookie-es` serializer h3 uses when setting
 * the cookie, so we reverse that here; a value that isn't validly encoded
 * (e.g. corrupted in transit) is returned as-is and will simply fail to
 * unseal below.
 */
function readCookieValue(
  cookieHeader: string,
  name: string,
): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=')
    if (eqIndex === -1) continue
    const key = part.slice(0, eqIndex).trim()
    if (key !== name) continue
    const rawValue = part.slice(eqIndex + 1).trim()
    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }
  return undefined
}

/**
 * Authenticates a raw `Request` by reading and unsealing its `google-sso`
 * session cookie *without* going through TanStack Start's request-scoped
 * async context (`useSession` requires that context, which is unavailable
 * outside a handled HTTP request — e.g. inside a raw WebSocket-upgrade
 * hook). It unseals with the exact same primitive `useSession` uses under
 * the hood (h3's `unsealSession`, from the `h3-v2` package that
 * `@tanstack/react-start/server` depends on), so a cookie minted by the
 * normal login flow verifies here too. Never throws — any missing,
 * corrupted, expired, or tampered cookie resolves to `false`.
 */
export async function resolveIsAuthenticatedFromRequest(
  request: Request,
): Promise<boolean> {
  try {
    const cookieHeader = request.headers.get('cookie')
    if (!cookieHeader) return false

    const sealed = readCookieValue(cookieHeader, SESSION_COOKIE_NAME)
    if (!sealed) return false

    const { password, maxAge } = getSessionConfig()
    const session = await unsealSession(
      mockEvent(request),
      { password, maxAge },
      sealed,
    )
    return !!session.data?.sub
  } catch {
    return false
  }
}
