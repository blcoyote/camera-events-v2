/**
 * Format a duration in seconds as a compact human string showing the two
 * largest non-zero units (e.g. "3d 4h", "4h 12m", "12m", "<1m").
 */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) return '<1m'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  return `${mins}m`
}

/**
 * Format a storage size given in megabytes (Frigate reports stats storage in
 * MB) as MB / GB / TB with one decimal place above the MB range.
 */
export function formatStorageMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return '0 MB'
  if (mb < 1024) return `${Math.round(mb)} MB`
  if (mb < 1024 * 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${(mb / 1024 / 1024).toFixed(1)} TB`
}

/** Format a 0–100 number as a rounded percentage string. */
export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value)}%`
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Format a Frigate summary day key ("YYYY-MM-DD") as "Mon D". Parsed manually
 * rather than via Date so the output is identical on server and client
 * regardless of locale/timezone (avoids SSR hydration mismatches). Returns the
 * raw input unchanged if it is not a well-formed day key.
 */
export function formatDayLabel(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return day
  const month = Number(match[2])
  const dayOfMonth = Number(match[3])
  if (month < 1 || month > 12) return day
  return `${MONTHS[month - 1]} ${dayOfMonth}`
}
