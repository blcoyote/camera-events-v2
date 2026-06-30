import type { ReactNode } from 'react'

/**
 * A compact summary tile: a big value with a caption underneath, plus an
 * optional accent icon. Used for the dashboard's top-line numbers.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-(--line) bg-(--surface) px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-(--sea-ink-soft)">
          {label}
        </p>
        {icon && <span className="text-(--lagoon)">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-(--sea-ink)">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-(--sea-ink-soft)">{hint}</p>}
    </div>
  )
}
