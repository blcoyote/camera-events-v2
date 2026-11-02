import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { validateEventListFilters } from '#/features/shared/utils/eventListSearch'
import { translateLabel } from '#/features/shared/utils/labels'
import { formatCameraName } from '#/features/shared/utils/eventFormatting'
import type { BreadcrumbFn, Crumb } from '#/features/shared/navigation/types'

type EventOrigin = 'events' | 'favorites'

export interface EventDetailSearch {
  from?: EventOrigin
  camera?: string
  type?: string
}

export function validateEventDetailSearch(
  s: Record<string, unknown>,
): EventDetailSearch {
  const from =
    s.from === 'events' || s.from === 'favorites' ? s.from : undefined
  return { from, ...validateEventListFilters(s) }
}

function parentCrumb(search: Record<string, unknown>): Crumb {
  if (search.from === 'favorites') {
    return { label: m.shell_tab_favorites(), to: '/favorites' }
  }
  const { type, camera } = validateEventListFilters(search)
  const filters: Record<string, string> = {}
  if (camera) filters.camera = camera
  if (type) filters.type = type
  const crumb: Crumb = { label: m.shell_tab_events(), to: '/camera-events' }
  if (Object.keys(filters).length > 0) crumb.search = filters
  return crumb
}

function currentLabel(loaderData: unknown): string {
  const result = (loaderData as { result?: unknown } | null | undefined)?.result
  if (typeof result === 'object' && result !== null) {
    const r = result as { ok?: unknown; data?: unknown }
    if (r.ok === true && typeof r.data === 'object' && r.data !== null) {
      const d = r.data as { label?: unknown; camera?: unknown }
      if (typeof d.label === 'string' && typeof d.camera === 'string') {
        return `${translateLabel(d.label, getLocale())} · ${formatCameraName(d.camera)}`
      }
    }
  }
  return m.shell_title_event()
}

export const eventDetailBreadcrumb: BreadcrumbFn = ({ search, loaderData }) => [
  parentCrumb(search),
  { label: currentLabel(loaderData) },
]
