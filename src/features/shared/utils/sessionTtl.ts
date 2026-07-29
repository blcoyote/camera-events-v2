/**
 * Session lifetime arithmetic — deliberately isomorphic.
 *
 * The server needs these to set the cookie's `maxAge` and to stamp
 * `SessionData.expiresAt`; the client needs to reason about how much session
 * lifetime is left (the cookie is httpOnly, so the stamp is its only view).
 *
 * This lives outside `shared/server/` on purpose: `session.ts` imports
 * `@tanstack/react-start/server`, so anything reachable from client code that
 * pulled these values from there would trip import protection.
 */

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

/**
 * Expiry instant (epoch ms) for a session cookie issued at `nowMs`.
 * Mirrors the cookie's own maxAge so the value handed to the client always
 * matches the real cookie lifetime.
 */
export function computeSessionExpiry(nowMs: number): number {
  return nowMs + SESSION_MAX_AGE_SECONDS * 1000
}
