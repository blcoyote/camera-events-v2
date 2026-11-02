import { useMatches } from '@tanstack/react-router'
import { resolveBreadcrumbs } from './resolveBreadcrumbs'
import type { Crumb } from './types'

export function useBreadcrumbs(): Crumb[] {
  return resolveBreadcrumbs(useMatches())
}
