import { Bell, Cctv, Heart, Settings } from 'lucide-react'

export const TABS = [
  { label: 'Cameras', to: '/cameras', icon: Cctv },
  { label: 'Events', to: '/camera-events', icon: Bell },
  { label: 'Favorites', to: '/favorites', icon: Heart },
  { label: 'Settings', to: '/settings', icon: Settings },
]

const owns = (path: string, base: string) =>
  path === base || path.startsWith(`${base}/`)

export function getActiveTab(pathname: string): string | null {
  if (owns(pathname, '/live')) return '/cameras'
  return TABS.find((t) => owns(pathname, t.to))?.to ?? null
}

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/camera-events/')) return 'Event'
  if (owns(pathname, '/live')) return 'Live view'
  return TABS.find((t) => t.to === pathname)?.label ?? 'Camera Events'
}
