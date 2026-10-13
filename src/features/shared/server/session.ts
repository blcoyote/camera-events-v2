import '@tanstack/react-start/server-only'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'
import { SESSION_MAX_AGE_SECONDS } from '#/features/shared/utils/sessionTtl'
import {
  createStoredSession,
  sealStoredSession,
  unsealStoredSession,
} from '#/features/shared/server/session-seal'
import type { StoredSession } from '#/features/shared/server/session-seal'

export type SessionData = {
  /** Google OpenID Connect subject identifier (unique per user) */
  sub: string
  firstName: string
  email: string
  avatarUrl: string
  /**
   * Epoch milliseconds at which the session cookie expires, stamped each time
   * the TTL slides. Optional because sessions issued before this field existed
   * are still valid — they gain it on their next page load.
   *
   * The session cookie is httpOnly, so this is the only way the client can see
   * how much session lifetime is left and refresh proactively.
   */
  expiresAt?: number
}

/**
 * Base session config — password is added lazily at call time
 * to avoid module-scope env access.
 */
export const SESSION_COOKIE_NAME = 'google-sso'

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

export type AppSessionConfig = typeof SESSION_CONFIG_BASE & { password: string }

export function getSessionConfig(): AppSessionConfig {
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
 * The live session for the current request. `data` is a snapshot taken when
 * the session was read; `update`/`clear` perform the corresponding cookie
 * mutation.
 */
export type AppSession = {
  readonly data: Partial<SessionData>
  update: (data: Partial<SessionData>) => Promise<void>
  clear: () => Promise<void>
}

async function persistSession(
  session: StoredSession<SessionData>,
  config: AppSessionConfig,
): Promise<void> {
  const sealed = await sealStoredSession(
    session,
    config.password,
    config.maxAge,
  )
  setCookie(SESSION_COOKIE_NAME, sealed, {
    ...config.cookie,
    expires: new Date(session.createdAt + config.maxAge * 1000),
  })
}

/**
 * Reads the current session cookie, if any. Never sets or deletes a cookie
 * as a side effect of reading — anonymous visitors must not receive one.
 * An invalid, missing, or expired cookie resolves to an empty session.
 */
export async function getAppSession(): Promise<AppSession> {
  const config = getSessionConfig()
  const cookieValue = getCookie(SESSION_COOKIE_NAME)

  let stored: StoredSession<SessionData> | null = null
  if (cookieValue) {
    stored = await unsealStoredSession<SessionData>(
      cookieValue,
      config.password,
      config.maxAge,
    )
  }

  const data: Partial<SessionData> = stored?.data ?? {}

  return {
    data,
    async update(patch) {
      const base = stored ?? createStoredSession<SessionData>()
      const merged: StoredSession<SessionData> = {
        ...base,
        data: { ...base.data, ...patch },
      }
      await persistSession(merged, config)
    },
    async clear() {
      await clearAppSession()
    },
  }
}

/**
 * Always starts a brand-new session (new id, createdAt = now), ignoring any
 * existing cookie. Used at sign-in to rotate the session rather than merge
 * into a stale/anonymous one.
 */
export async function startNewAppSession(data: SessionData): Promise<void> {
  const config = getSessionConfig()
  const session = createStoredSession<SessionData>()
  session.data = data
  await persistSession(session, config)
}

/** Deletes the session cookie. */
export async function clearAppSession(): Promise<void> {
  const config = getSessionConfig()
  deleteCookie(SESSION_COOKIE_NAME, config.cookie)
}

/**
 * Require an authenticated session. Returns the user's subject ID.
 * Throws if the session is missing, corrupted, or unauthenticated.
 *
 * Use this inside createServerFn handlers — route-level layout guards
 * only protect client-side navigation, not direct server function calls.
 */
export async function requireSession(): Promise<string> {
  const session = await getAppSession()
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
    const session = await getAppSession()
    return !!session.data.sub
  } catch {
    return false
  }
}
