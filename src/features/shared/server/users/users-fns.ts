import { createServerFn } from '@tanstack/react-start'

export const getShareRecipientsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getShareRecipientsHandler } = await import('./users-handlers')
    return getShareRecipientsHandler()
  },
)
