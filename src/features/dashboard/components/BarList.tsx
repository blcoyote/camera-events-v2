export interface BarListItem {
  key: string
  label: string
  count: number
  /** Optional bar fill color (CSS color). Falls back to the lagoon token. */
  color?: string
}

/**
 * Scale a set of counts to 0–100 bar widths relative to the largest value.
 * Returns all zeros when there is no positive count (avoids divide-by-zero).
 */
export function computeBarPercents(counts: number[]): number[] {
  const max = Math.max(0, ...counts)
  if (max === 0) return counts.map(() => 0)
  return counts.map((c) => (c / max) * 100)
}

export function BarList({
  items,
  emptyMessage = 'No data',
}: {
  items: BarListItem[]
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-(--sea-ink-soft)">{emptyMessage}</p>
  }
  const percents = computeBarPercents(items.map((i) => i.count))
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={item.key} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs font-medium text-(--sea-ink-soft)">
            {item.label}
          </span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-(--surface-strong)">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${percents[i]}%`,
                backgroundColor: item.color ?? 'var(--lagoon)',
              }}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-(--sea-ink)">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  )
}
