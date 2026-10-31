import { m } from '#/paraglide/messages.js'
import { Card } from '#/features/shared/components/ui/card'
import { Switch } from '#/features/shared/components/ui/switch'

export function AvailabilityAlertsToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}) {
  return (
    <Card variant="flat" className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          {m.settings_availability_title()}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {m.settings_availability_hint()}
        </p>
      </div>
      <Switch
        aria-label={m.settings_availability_switch()}
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </Card>
  )
}
