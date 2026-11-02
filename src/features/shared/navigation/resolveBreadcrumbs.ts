import { m } from '#/paraglide/messages.js'
import type { BreadcrumbFn, Crumb } from './types'

interface MatchLike {
  staticData?: { breadcrumb?: BreadcrumbFn }
  params?: unknown
  search?: unknown
  loaderData?: unknown
}

export function resolveBreadcrumbs(matches: ReadonlyArray<MatchLike>): Crumb[] {
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    const breadcrumb = match.staticData?.breadcrumb
    if (!breadcrumb) continue
    const crumbs = breadcrumb({
      params: (match.params ?? {}) as Record<string, string>,
      search: (match.search ?? {}) as Record<string, unknown>,
      loaderData: match.loaderData,
    })
    if (crumbs.length > 0) return crumbs
    break
  }
  return [{ label: m.shell_title_app() }]
}
