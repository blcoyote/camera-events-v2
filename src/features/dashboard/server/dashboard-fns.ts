import { createServerFn } from '@tanstack/react-start'

export const loadDashboardFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { loadDashboardHandler } = await import('./dashboard-handlers')
    return loadDashboardHandler()
  },
)
