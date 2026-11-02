import type { BreadcrumbFn } from './types'

/** Single-crumb trail for a top-level tab; label resolves per call (per render). */
export function tabBreadcrumb(label: () => string): BreadcrumbFn {
  return () => [{ label: label() }]
}
