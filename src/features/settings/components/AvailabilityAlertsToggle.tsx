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
          Camera Offline Notifications
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Get notified when a camera stops sending video or comes back online.
        </p>
      </div>
      <Switch
        aria-label="Camera offline notifications"
        checked={enabled}
        onCheckedChange={onToggle}
      />
    </Card>
  )
}
