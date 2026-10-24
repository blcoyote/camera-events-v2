import { cn } from '#/features/shared/utils/cn'
import { Toggle } from '#/features/shared/components/ui/toggle'

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
    <Toggle
      pressed={active}
      onPressedChange={() => onClick()}
      className="shrink-0 gap-1.5 font-semibold hover:-translate-y-0.5"
    >
      {label}
      {count !== undefined && (
        <span className={cn('text-xs', !active && 'text-muted-foreground')}>
          {count}
        </span>
      )}
    </Toggle>
  )
}
