import type { Decorator } from '@storybook/react-vite'
import {
  createRootRouteWithContext,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router'
import type { SessionData } from '../../src/features/shared/server/session'

interface RouterContext {
  user: SessionData | null
}

/**
 * Creates a Storybook decorator that wraps stories in a TanStack Router context.
 * Use this for any component that depends on `Link`, `useRouteContext`, or other
 * router hooks.
 *
 * @param routeContext - The root route context to inject (e.g. `{ user: null }`)
 */
export function withRouter(
  routeContext: RouterContext = { user: null },
): Decorator {
  return (Story) => {
    const rootRoute = createRootRouteWithContext<RouterContext>()({
      component: () => (
        <>
          <Outlet />
          <Story />
        </>
      ),
      notFoundComponent: () => null,
    })

    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/'] }),
      context: routeContext,
      defaultNotFoundComponent: () => null,
    })

    return <RouterProvider router={router} />
  }
}
