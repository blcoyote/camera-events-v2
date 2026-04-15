export function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now() / 1000
  const diff = now - unixSeconds
  if (diff < 0) return 'Just now'
  if (diff < 60) return 'Just now'
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins}m ago`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours}h ago`
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return `${days}d ago`
  }
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatLabelName(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
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
