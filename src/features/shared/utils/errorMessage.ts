import { m } from '#/paraglide/messages.js'

const messages: Record<string, () => string> = {
  unauthorized: m.error_unauthorized,
  forbidden: m.error_forbidden,
  push_not_configured: m.error_push_not_configured,
  invalid_body: m.error_invalid_body,
  invalid_endpoint: m.error_invalid_endpoint,
  endpoint_not_https: m.error_endpoint_not_https,
  cameras_unavailable: m.error_cameras_unavailable,
  invalid_camera_name: m.error_invalid_camera_name,
  internal_error: m.error_internal_error,
}

/** Translate a stable server error code; unknown or missing codes get a generic message. */
export function errorMessage(code: string | undefined): string {
  return (
    code && Object.hasOwn(messages, code) ? messages[code] : m.error_unknown
  )()
}
