import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { useSession, clearSession } from '@tanstack/react-start/server'
import { getSessionConfig  } from './session'
import type {SessionData} from './session';

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
 * Derive a 256-bit encryption key from the session secret.
 */
function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypt the OAuth state cookie payload using AES-256-GCM.
 * Returns base64-encoded: IV (12 bytes) + auth tag (16 bytes) + ciphertext.
 */
export function encryptOAuthState(plaintext: string): string {
  const { password } = getSessionConfig()
  const key = deriveKey(password)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt the OAuth state cookie payload.
 * Returns null if decryption fails (tampered or wrong key).
 */
export function decryptOAuthState(ciphertext: string): string | null {
  try {
    const { password } = getSessionConfig()
    const key = deriveKey(password)
    const data = Buffer.from(ciphertext, 'base64')
    if (data.length < 28) return null // minimum: 12 (iv) + 16 (tag)
    const iv = data.subarray(0, 12)
    const tag = data.subarray(12, 28)
    const encrypted = data.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
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
