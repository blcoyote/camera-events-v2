import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCameras } from '#/server/frigate/client'
import { CamerasPage, CamerasLoading } from '#/pages/cameras/CamerasPage'
import type { FrigateResult } from '#/server/frigate/config'

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
