import { liveViewBreadcrumb } from '#/features/live-view/utils/liveViewBreadcrumb'
import { createFileRoute } from '@tanstack/react-router'
import { LiveViewPage } from '#/features/live-view/pages/LiveViewPage'

export const Route = createFileRoute('/_authenticated/live/$name')({
  staticData: { breadcrumb: liveViewBreadcrumb },
  component: LiveViewRoute,
})

function LiveViewRoute() {
  const { name } = Route.useParams()
  return <LiveViewPage cameraName={name} />
}
