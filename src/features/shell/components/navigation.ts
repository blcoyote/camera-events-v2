import { m } from '#/paraglide/messages.js'
import type { Crumb } from '#/features/shared/navigation/types'
import { Bell, Cctv, Heart, Settings } from 'lucide-react'

// `label` is a getter so the message resolves per render, not at import.
export const TABS = [
  {
    get label() {
      return m.shell_tab_cameras()
    },
    to: '/cameras',
    icon: Cctv,
  },
  {
    get label() {
      return m.shell_tab_events()
    },
    to: '/camera-events',
    icon: Bell,
  },
  {
    get label() {
      return m.shell_tab_favorites()
    },
    to: '/favorites',
    icon: Heart,
  },
  {
    get label() {
      return m.shell_tab_settings()
    },
    to: '/settings',
    icon: Settings,
  },
]

const owns = (path: string, base: string) =>
  path === base || path.startsWith(`${base}/`)

export function getActiveTab(
  pathname: string,
  search?: Record<string, unknown>,
): string | null {
  if (pathname.startsWith('/camera-events/') && search?.from === 'favorites')
    return '/favorites'
  if (owns(pathname, '/live')) return '/cameras'
  return TABS.find((t) => owns(pathname, t.to))?.to ?? null
}

export function getTitleBar(crumbs: Crumb[]): {
  title: string
  back: Crumb | null
} {
  const title = crumbs[crumbs.length - 1]?.label ?? ''
  const prev = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined
  return { title, back: prev?.to ? prev : null }
}
