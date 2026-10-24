import { Card } from '#/features/shared/components/ui/card'
import { Switch } from '#/features/shared/components/ui/switch'

export interface CameraPref {
  name: string
  enabled: boolean
}

function formatCameraName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function CameraPreferences({
  cameras,
  loading,
  onToggle,
}: {
  cameras: CameraPref[]
  loading: boolean
  onToggle: (camera: string, enabled: boolean) => void
}) {
  return (
    <Card variant="flat" className="mt-2">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Camera Notifications
      </h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Choose which cameras send you push notifications.
      </p>
      {loading ? (
        <div className="h-6" />
      ) : (
        <ul className="flex flex-col gap-3">
          {cameras.map((cam) => (
            <li key={cam.name} className="flex items-center justify-between">
              <span className="text-sm text-foreground">
                {formatCameraName(cam.name)}
              </span>
              <Switch
                aria-label={`Notifications for ${formatCameraName(cam.name)}`}
                checked={cam.enabled}
                onCheckedChange={(checked) => onToggle(cam.name, checked)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
