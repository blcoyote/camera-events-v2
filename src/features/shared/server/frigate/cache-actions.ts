import { createServerFn } from '@tanstack/react-start'

export const clearCacheFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { requireSession } = await import('#/features/shared/server/session')
    const { clearFrigateCache } = await import('./cache')
    await requireSession()
    clearFrigateCache()
  },
)
