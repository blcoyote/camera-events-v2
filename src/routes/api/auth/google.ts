import { createFileRoute } from '@tanstack/react-router'
import { generateState, generateCodeVerifier } from 'arctic'
import { setCookie } from '@tanstack/react-start/server'
import {
  getGoogleProvider,
  getAppOrigin,
} from '#/features/auth/server/google-oauth'
import {
  buildOAuthState,
  OAUTH_SCOPES,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_COOKIE_OPTIONS,
  sanitizeReturnTo,
} from '#/features/auth/server/auth'
import { encryptOAuthState } from '#/features/auth/server/auth-crypto'

export const Route = createFileRoute('/api/auth/google')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const returnTo = sanitizeReturnTo(
          url.searchParams.get('returnTo') || undefined,
        )

        const origin = getAppOrigin(url.origin)
        const redirectUri = `${origin}/api/auth/google/callback`
        const google = getGoogleProvider(redirectUri)

        const state = generateState()
        const codeVerifier = generateCodeVerifier()
        const authorizationUrl = google.createAuthorizationURL(
          state,
          codeVerifier,
          OAUTH_SCOPES,
        )

        // Store state + codeVerifier in an encrypted short-lived cookie
        const oauthStateCookie = encryptOAuthState(
          buildOAuthState(state, codeVerifier, returnTo),
        )
        setCookie(
          OAUTH_STATE_COOKIE_NAME,
          oauthStateCookie,
          OAUTH_STATE_COOKIE_OPTIONS,
        )

        return new Response(null, {
          status: 302,
          headers: { Location: authorizationUrl.toString() },
        })
      },
    },
  },
})
