import { m } from '#/paraglide/messages.js'
import type { BreadcrumbFn } from '#/features/shared/navigation/types'
import { formatCameraName } from '#/features/shared/utils/eventFormatting'

export const liveViewBreadcrumb: BreadcrumbFn = ({ params }) => [
  { label: m.shell_tab_cameras(), to: '/cameras' },
  { label: formatCameraName(params.name ?? '') },
]
