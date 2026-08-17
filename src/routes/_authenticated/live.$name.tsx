import { createFileRoute } from '@tanstack/react-router'
import { LiveViewPage } from '#/features/live-view/pages/LiveViewPage'

export const Route = createFileRoute('/_authenticated/live/$name')({
  component: LiveViewRoute,
})

function LiveViewRoute() {
  const { name } = Route.useParams()
  return <LiveViewPage cameraName={name} />
}
