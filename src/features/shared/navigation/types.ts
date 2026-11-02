export interface Crumb {
  label: string
  to?: string // absent on the current (last) crumb
  search?: Record<string, string>
}
export interface BreadcrumbMatch {
  params: Record<string, string>
  search: Record<string, unknown>
  loaderData: unknown
}
export type BreadcrumbFn = (match: BreadcrumbMatch) => Crumb[]

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    breadcrumb?: BreadcrumbFn
  }
}
