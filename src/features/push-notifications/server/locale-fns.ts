import { createServerFn } from '@tanstack/react-start'

export const updatePushLocaleFn = createServerFn({ method: 'POST' })
  .validator((data: { endpoint: string; locale: string }) => data)
  .handler(async ({ data }) => {
    const { updatePushLocaleHandler } = await import('./locale-handlers')
    return updatePushLocaleHandler(data)
  })
