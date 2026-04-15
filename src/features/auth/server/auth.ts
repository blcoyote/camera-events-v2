import { createServerFn } from '@tanstack/react-start'
import { useSession, clearSession } from '@tanstack/react-start/server'
import { getSessionConfig  } from '#/features/shared/server/session'
import type {SessionData} from '#/features/shared/server/session';

export const OAUTH_SCOPES = ['openid', 'profile', 'email']

export const OAUTH_STATE_COOKIE_NAME = 'oauth_state'

/**
 * Validate that a returnTo path is safe for redirect.
 * Rejects absolute URLs, protocol-relative URLs, and paths with backslashes.
 * Returns the path if safe, undefined otherwise.
 */
export function sanitizeReturnTo(returnTo: string | undefined): string | undefined {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return undefined
  }
  // Block backslashes (some browsers treat /\ as protocol-relative)
  if (returnTo.includes('\\')) {
    return undefined
  }
  // Parse and verify the path stays on the same origin
  try {
    const parsed = new URL(returnTo, 'http://localhost')
    if (parsed.hostname !== 'localhost') {
      return undefined
    }
  } catch {
    return undefined
  }
  return returnTo
}

export const OAUTH_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 300, // 5 minutes
  secure: process.env.NODE_ENV === 'production',
}

/** Build a 302 redirect Response. */
export function redirectTo(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  })
}

/**
 * Encode OAuth state + PKCE codeVerifier + optional returnTo into a
 * base64 string for storage in the oauth_state cookie.
 */
export function buildOAuthState(
  state: string,
  codeVerifier: string,
  returnTo?: string,
): string {
  const payload: Record<string, string> = { state, codeVerifier }
  if (returnTo) {
    payload.returnTo = returnTo
  }
  return btoa(JSON.stringify(payload))
}

/**
 * Parse the oauth_state cookie value back into its components.
 * Returns null if the value is malformed.
 */
export function parseOAuthState(
  cookieValue: string,
): { state: string; codeVerifier: string; returnTo?: string } | null {
  try {
    const decoded = JSON.parse(atob(cookieValue))
    if (
      typeof decoded.state !== 'string' ||
      typeof decoded.codeVerifier !== 'string'
    ) {
      return null
    }
    return {
      state: decoded.state,
      codeVerifier: decoded.codeVerifier,
      ...(typeof decoded.returnTo === 'string'
        ? { returnTo: decoded.returnTo }
        : {}),
    }
  } catch {
    return null
  }
}

/**
 * Server function to get the current authenticated user from the session.
 * Returns null if no session or if the cookie is corrupted.
 */
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionData | null> => {
    try {
      const session = await useSession<SessionData>(getSessionConfig())
      if (!session.data.sub) {
        return null
      }
      return {
        sub: session.data.sub,
        firstName: session.data.firstName ?? '',
        email: session.data.email ?? '',
        avatarUrl: session.data.avatarUrl ?? '',
      }
    } catch {
      // Corrupted or tampered cookie — treat as unauthenticated
      try {
        await clearSession(getSessionConfig())
      } catch {
        // Ignore clear errors
      }
      return null
    }
  },
)
