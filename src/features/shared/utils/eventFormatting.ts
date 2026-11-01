import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { formatDate } from './intl'

export function formatRelativeTime(unixSeconds: number): string {
  const locale = getLocale()
  const now = Date.now() / 1000
  const diff = now - unixSeconds
  if (diff < 0) return m.shared_time_just_now({}, { locale })
  if (diff < 60) return m.shared_time_just_now({}, { locale })
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return m.shared_time_minutes_ago({ count: mins }, { locale })
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return m.shared_time_hours_ago({ count: hours }, { locale })
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return m.shared_time_days_ago({ count: days }, { locale })
  }
  return formatDate(unixSeconds, locale)
}

const LABEL_DOT_COLORS: Record<string, string> = {
  person: '#4fb8b2',
  car: '#f59e0b',
  truck: '#f59e0b',
  motorcycle: '#f59e0b',
  bicycle: '#d97706',
  bus: '#f59e0b',
  dog: '#22c55e',
  cat: '#22c55e',
  bird: '#34d399',
  bear: '#16a34a',
  package: '#818cf8',
}

export function getLabelDotColor(label: string): string {
  return LABEL_DOT_COLORS[label] ?? '#94a3b8'
}

export function formatCameraName(camera: string): string {
  return camera
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
