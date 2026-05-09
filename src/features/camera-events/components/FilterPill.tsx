export function FilterPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
        active
          ? 'border-[rgba(50,143,151,0.4)] bg-[rgba(79,184,178,0.18)] text-(--lagoon-deep)'
          : 'border-(--chip-line) bg-(--chip-bg) text-(--sea-ink-soft) hover:text-(--sea-ink)'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="text-xs opacity-60">{count}</span>
      )}
    </button>
  )
}
