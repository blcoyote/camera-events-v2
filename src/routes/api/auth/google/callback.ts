import { createFileRoute } from '@tanstack/react-router'
import { decodeIdToken } from 'arctic'
import {
  getCookie,
  deleteCookie,
  useSession,
} from '@tanstack/react-start/server'
import {
  getGoogleProvider,
  getAppOrigin,
  validateIdTokenClaims,
  parseIdTokenClaims,
} from '#/features/auth/server/google-oauth'
import {
  parseOAuthState,
  OAUTH_STATE_COOKIE_NAME,
  sanitizeReturnTo,
  redirectTo,
} from '#/features/auth/server/auth'
import { decryptOAuthState } from '#/features/auth/server/auth-crypto'
import { getSessionConfig } from '#/features/shared/server/session'
import type { SessionData } from '#/features/shared/server/session'

export const Route = createFileRoute('/api/auth/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const oauthError = url.searchParams.get('error')

        // Handle denied consent or Google-side errors
        if (oauthError) {
          const errorType =
            oauthError === 'access_denied' ? 'access_denied' : 'login_failed'
          return redirectTo(`/?error=${errorType}`)
        }

        // Validate and decrypt the state cookie
        const oauthStateCookie = getCookie(OAUTH_STATE_COOKIE_NAME)
        if (!oauthStateCookie) {
          return redirectTo('/?error=invalid_state')
        }

        const decryptedState = decryptOAuthState(oauthStateCookie)
        if (!decryptedState) {
          deleteCookie(OAUTH_STATE_COOKIE_NAME)
          return redirectTo('/?error=invalid_state')
        }

        // Parse and validate state
        const storedState = parseOAuthState(decryptedState)
        const callbackState = url.searchParams.get('state')
        if (!storedState || storedState.state !== callbackState) {
          deleteCookie(OAUTH_STATE_COOKIE_NAME)
          return redirectTo('/?error=invalid_state')
        }

        if (!code) {
          deleteCookie(OAUTH_STATE_COOKIE_NAME)
          return redirectTo('/?error=login_failed')
        }

        try {
          const origin = getAppOrigin(url.origin)
          const redirectUri = `${origin}/api/auth/google/callback`
          const google = getGoogleProvider(redirectUri)

          // Exchange code for tokens
          const tokens = await google.validateAuthorizationCode(
            code,
            storedState.codeVerifier,
          )

          // Decode ID token claims
          const idTokenClaims = decodeIdToken(tokens.idToken()) as Record<
            string,
            unknown
          >

          // Validate ID token claims (iss, aud, exp)
          if (!validateIdTokenClaims(idTokenClaims)) {
            deleteCookie(OAUTH_STATE_COOKIE_NAME)
            return redirectTo('/?error=login_failed')
          }

          // Reject unverified email addresses
          if (idTokenClaims.email_verified !== true) {
            deleteCookie(OAUTH_STATE_COOKIE_NAME)
            return redirectTo('/?error=login_failed')
          }

          const sessionData = parseIdTokenClaims(idTokenClaims)

          // Write session
          const session = await useSession<SessionData>(getSessionConfig())
          await session.update(sessionData)

          // Clean up oauth_state cookie
          deleteCookie(OAUTH_STATE_COOKIE_NAME)

          // Redirect to returnTo or home (defense-in-depth validation)
          const returnTo = sanitizeReturnTo(storedState.returnTo) || '/'
          return redirectTo(returnTo)
        } catch {
          deleteCookie(OAUTH_STATE_COOKIE_NAME)
          return redirectTo('/?error=login_failed')
        }
      },
    },
  },
})
