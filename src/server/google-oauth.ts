import { Google } from 'arctic'
import type { SessionData } from './session'

const GOOGLE_ISSUER = 'https://accounts.google.com'

/**
 * Return the configured app origin (APP_URL) or fall back to the request origin.
 * APP_URL should be set in production to prevent Host header manipulation.
 */
export function getAppOrigin(requestOrigin: string): string {
  return process.env.APP_URL || requestOrigin
}

/**
 * Create a Google OAuth provider instance.
 * Called lazily inside handlers to avoid module-scope env access.
 */
export function getGoogleProvider(redirectUri: string): Google {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is required')
  }
  if (!clientSecret) {
    throw new Error('GOOGLE_CLIENT_SECRET environment variable is required')
  }
  return new Google(clientId, clientSecret, redirectUri)
}

/**
 * Validate ID token claims: issuer, audience, and expiration.
 * The token was received directly from Google's token endpoint over TLS,
 * so signature verification is not required per the OIDC spec (section 3.1.3.7).
 * These checks provide defense-in-depth against token substitution or replay.
 */
export function validateIdTokenClaims(claims: Record<string, unknown>): boolean {
  if (claims.iss !== GOOGLE_ISSUER) return false
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) return false
  if (typeof claims.exp !== 'number') return false
  if (claims.exp < Math.floor(Date.now() / 1000)) return false
  return true
}

/**
 * Parse Google ID token claims into our session data shape.
 * Handles missing given_name and picture gracefully.
 */
export function parseIdTokenClaims(claims: Record<string, unknown>): SessionData {
  return {
    sub: String(claims.sub ?? ''),
    firstName: String(claims.given_name ?? ''),
    email: String(claims.email ?? ''),
    avatarUrl: String(claims.picture ?? ''),
  }
}
