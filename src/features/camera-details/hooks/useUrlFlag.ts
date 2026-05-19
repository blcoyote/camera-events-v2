import { useRouterState } from '@tanstack/react-router'

/**
 * SSR-safe URL flag reader. Returns true iff the current URL has
 * `?key=value`. Subscribes via TanStack Router's state (not popstate),
 * so it updates correctly on programmatic navigation as well as
 * browser back/forward.
 *
 * Does not touch window.location, so it is safe to call during SSR
 * and produces the same value on server and client (no hydration
 * mismatch when the flag is set in the initial URL).
 */
export function useUrlFlag(key: string, value: string): boolean {
  return useRouterState({
    select: (state) => {
      const search = (
        state as { location: { search: Record<string, unknown> } }
      ).location.search
      return search[key] === value
    },
  })
}
