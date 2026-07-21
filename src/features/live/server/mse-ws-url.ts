import { getGo2RtcBase } from '#/features/shared/server/frigate/config'
import { isValidCameraName } from '#/features/shared/server/frigate/validation'

/**
 * Build the upstream go2rtc MSE WebSocket URL for a camera. This is the URL
 * our server-side WS relay connects to — Frigate/go2rtc are internal, the
 * browser never sees this URL directly.
 */
export function go2rtcMseWsUrl(cameraName: string): string {
  if (!isValidCameraName(cameraName)) {
    throw new Error(`Invalid camera name: ${cameraName}`)
  }
  const base = getGo2RtcBase() // http(s)://host/live/webrtc/api
  // Swap only the leading HTTP scheme for the WS scheme: http->ws, https->wss.
  const wsBase = base.replace(
    /^http(s?):\/\//i,
    (_match, s: string) => `ws${s}://`,
  )
  return `${wsBase}/ws?src=${encodeURIComponent(cameraName)}`
}
