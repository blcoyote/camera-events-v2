import '@tanstack/react-start/server-only'
import { getPushStore } from './push-store'
import { isPushLocale } from './push-locale'
import { readBodyField } from './request-body'

/** Exported for unit testing. userId comes from the session, never the body. */
export async function handleUpdateLocale(
  userId: string | null,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!userId) return { status: 401, body: { error: 'unauthorized' } }

  const endpoint = readBodyField(body, 'endpoint')
  const locale = readBodyField(body, 'locale')
  if (typeof endpoint !== 'string' || !isPushLocale(locale)) {
    return { status: 400, body: { error: 'invalid_body' } }
  }
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return { status: 400, body: { error: 'invalid_body' } }
  }
  if (url.protocol !== 'https:') {
    return { status: 400, body: { error: 'invalid_body' } }
  }

  const updated = (await getPushStore()).updateLocale(userId, endpoint, locale)
  return { status: 200, body: { updated } }
}
