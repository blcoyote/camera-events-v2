import { m } from '#/paraglide/messages.js'
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

export function getActiveTab(pathname: string): string | null {
  if (owns(pathname, '/live')) return '/cameras'
  return TABS.find((t) => owns(pathname, t.to))?.to ?? null
}

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/camera-events/')) return m.shell_title_event()
  if (owns(pathname, '/live')) return m.shell_title_live_view()
  return TABS.find((t) => t.to === pathname)?.label ?? m.shell_title_app()
}
