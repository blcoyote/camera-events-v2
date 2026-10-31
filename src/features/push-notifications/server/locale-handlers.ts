import '@tanstack/react-start/server-only'
import { requireSession } from '#/features/shared/server/session'
import { getPushStore } from './push-store'
import { isPushLocale } from './push-locale'

/** Exported for unit testing. requireSession() first; userId never comes from input. */
export async function updatePushLocaleHandler(input: {
  endpoint: unknown
  locale: unknown
}): Promise<{ updated: boolean }> {
  const userId = await requireSession()
  const { endpoint, locale } = input
  if (!isPushLocale(locale)) throw new Error('Invalid locale')
  if (typeof endpoint !== 'string') throw new Error('Invalid endpoint')
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('Invalid endpoint')
  }
  if (url.protocol !== 'https:') throw new Error('Invalid endpoint')

  const updated = (await getPushStore()).updateLocale(userId, endpoint, locale)
  return { updated }
}
