import { createFileRoute } from '@tanstack/react-router'
import { CameraEventsListPage } from '#/pages/camera-events/CameraEventsListPage'

export const Route = createFileRoute('/_authenticated/camera-events/')({
  component: CameraEventsListPage,
})
