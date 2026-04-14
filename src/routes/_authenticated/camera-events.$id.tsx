import { createFileRoute } from '@tanstack/react-router'
import { CameraEventDetailPage } from '#/pages/camera-events/CameraEventDetailPage'

export const Route = createFileRoute('/_authenticated/camera-events/$id')({
  component: CameraEventDetailRoute,
})

function CameraEventDetailRoute() {
  const { id } = Route.useParams()
  return <CameraEventDetailPage id={id} />
}
