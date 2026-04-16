/**
 * Pure functions for service worker push notification handling.
 * Extracted from sw.ts so they can be tested without SW globals.
 */

export interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
}

const DEFAULT_PAYLOAD: PushPayload = {
  title: 'Notification',
  body: '',
  url: '/',
}

/**
 * Parse the push event data into a typed payload.
 * Falls back to defaults for missing or malformed data.
 */
export function parsePushPayload(data: unknown): PushPayload {
  if (!data || typeof data !== 'object') {
    return DEFAULT_PAYLOAD
  }

  const obj = data as Record<string, unknown>
  return {
    title:
      typeof obj.title === 'string' && obj.title
        ? obj.title
        : DEFAULT_PAYLOAD.title,
    body: typeof obj.body === 'string' ? obj.body : DEFAULT_PAYLOAD.body,
    url: typeof obj.url === 'string' && obj.url ? obj.url : DEFAULT_PAYLOAD.url,
    icon: typeof obj.icon === 'string' && obj.icon ? obj.icon : undefined,
  }
}

/**
 * Build the options object for showNotification.
 */
export function buildNotificationOptions(
  payload: PushPayload,
): NotificationOptions {
  return {
    body: payload.body,
    icon: payload.icon ?? '/logo192.png',
    data: { url: payload.url },
  }
}

/**
 * Extract the click target URL from notification data.
 * Only allows relative paths starting with "/" to prevent open redirect attacks.
 */
export function getNotificationClickUrl(notificationData: unknown): string {
  if (
    notificationData &&
    typeof notificationData === 'object' &&
    'url' in notificationData &&
    typeof (notificationData as Record<string, unknown>).url === 'string'
  ) {
    const url = (notificationData as Record<string, unknown>).url as string
    if (
      url.startsWith('/') &&
      !url.startsWith('//') &&
      !url.startsWith('/\\')
    ) {
      return url
    }
  }
  return '/'
}
