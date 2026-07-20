import { defineWebSocketHandler } from 'h3'
import { createWebSocketProxy } from 'crossws'
import { isValidCameraName } from '#/features/shared/server/frigate/validation'
import { resolveIsAuthenticatedFromRequest } from '#/features/shared/server/session'
import { go2rtcMseWsUrl } from '#/features/live/server/mse-ws-url'

/**
 * WebSocket relay for the `/live` MSE transport.
 *
 * The browser opens a WebSocket to our same-origin `/api/live/:name/ws`; this
 * handler authenticates the upgrade (cookie session, outside TanStack's request
 * context) and, on success, relays frames bidirectionally to go2rtc's MSE
 * WebSocket inside Frigate via crossws `createWebSocketProxy`. Frigate stays
 * internal — the browser never connects to go2rtc directly, and go2rtc's
 * internal port is unauthenticated so no upstream credential is forwarded.
 *
 * Registered as a Nitro-level WebSocket route in `vite.config.ts` (TanStack
 * file routes cannot perform a WS upgrade). See the live-hls → live-mse ADR.
 */

const LIVE_WS_PATH = /^\/api\/live\/([^/]+)\/ws$/

/**
 * Extract and validate the camera name from a `/api/live/:name/ws` request
 * URL. Returns the decoded name, or `null` when the path does not match or the
 * name fails `isValidCameraName` (path-traversal / injection guard — the name
 * flows into the upstream go2rtc URL).
 */
export function cameraNameFromWsRequest(url: string): string | null {
  let pathname: string
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }
  const match = LIVE_WS_PATH.exec(pathname)
  if (!match) return null
  let name: string
  try {
    name = decodeURIComponent(match[1])
  } catch {
    return null
  }
  return isValidCameraName(name) ? name : null
}

const proxy = createWebSocketProxy({
  target: (peer) => {
    const name = cameraNameFromWsRequest(peer.request.url)
    if (!name) {
      // Unreachable in practice: the upgrade hook rejects an invalid name
      // before `open`/`target` runs. Throw defensively so a misconfigured
      // route can never dial an unvalidated upstream.
      throw new Error('Invalid camera name for live WS relay')
    }
    return go2rtcMseWsUrl(name)
  },
})

/**
 * crossws hooks: the proxy's relay lifecycle (`open`/`message`/`close`) plus a
 * composed `upgrade` that validates the camera name and authenticates the
 * session before any upstream connection is opened. Exported for unit testing;
 * the default export wraps these for Nitro.
 */
export const liveMseWsHooks = {
  ...proxy,
  async upgrade(request: Request) {
    const name = cameraNameFromWsRequest(request.url)
    if (!name) {
      throw new Response(null, { status: 400 })
    }
    if (!(await resolveIsAuthenticatedFromRequest(request))) {
      throw new Response(null, { status: 401 })
    }
    // Preserve the proxy's own upgrade behaviour (sec-websocket-protocol
    // negotiation) once auth passes.
    return proxy.upgrade?.(request)
  },
}

export default defineWebSocketHandler(liveMseWsHooks)
