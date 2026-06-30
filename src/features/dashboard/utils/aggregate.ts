import type { FrigateEventSummary } from '#/features/shared/server/frigate/types'

/** A labelled count, ready to feed into a bar list. */
export interface CountEntry {
  key: string
  count: number
}

function sortByCountDesc(entries: CountEntry[]): CountEntry[] {
  // Highest count first; ties broken alphabetically for stable output.
  return entries.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

function groupSum(
  summary: FrigateEventSummary,
  pick: (item: FrigateEventSummary[number]) => string,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of summary) {
    const key = pick(item)
    counts.set(key, (counts.get(key) ?? 0) + item.count)
  }
  return counts
}

/** Total event count across the whole summary. */
export function totalEventCount(summary: FrigateEventSummary): number {
  return summary.reduce((sum, item) => sum + item.count, 0)
}

/** Event counts grouped by camera, busiest first. */
export function aggregateByCamera(summary: FrigateEventSummary): CountEntry[] {
  const counts = groupSum(summary, (item) => item.camera)
  return sortByCountDesc([...counts].map(([key, count]) => ({ key, count })))
}

/** Event counts grouped by object label, most frequent first. */
export function aggregateByLabel(summary: FrigateEventSummary): CountEntry[] {
  const counts = groupSum(summary, (item) => item.label)
  return sortByCountDesc([...counts].map(([key, count]) => ({ key, count })))
}

/** Event counts grouped by day, in chronological order. */
export function aggregateByDay(summary: FrigateEventSummary): CountEntry[] {
  const counts = groupSum(summary, (item) => item.day)
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => a.key.localeCompare(b.key))
}
