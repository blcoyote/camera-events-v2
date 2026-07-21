import { createServerFn } from '@tanstack/react-start'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

export const loadLiveCamerasFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<string[]>> => {
    const { requireSession } = await import('#/features/shared/server/session')
    const { getCameras } =
      await import('#/features/shared/server/frigate/client')
    await requireSession()
    return getCameras()
  },
)
