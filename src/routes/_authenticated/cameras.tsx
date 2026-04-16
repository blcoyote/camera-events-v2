import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCameras } from '#/features/shared/server/frigate/client'
import {
  CamerasPage,
  CamerasLoading,
} from '#/features/cameras/components/CamerasPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

const loadCameras = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FrigateResult<string[]>> => {
    return getCameras()
  },
)

export const Route = createFileRoute('/_authenticated/cameras')({
  loader: () => loadCameras(),
  pendingComponent: CamerasLoading,
  component: CamerasRoute,
})

function CamerasRoute() {
  const result = Route.useLoaderData()
  return <CamerasPage result={result} />
}
