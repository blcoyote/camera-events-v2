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
    <div className="mt-2 border-t border-(--chip-line) pt-5">
      <h3 className="mb-3 text-sm font-semibold text-(--sea-ink)">
        Camera Notifications
      </h3>
      <p className="mb-4 text-xs text-(--sea-ink-soft)">
        Choose which cameras send you push notifications.
      </p>
      {loading ? (
        <div className="h-6" />
      ) : (
        <ul className="flex flex-col gap-3">
          {cameras.map((cam) => (
            <li key={cam.name} className="flex items-center justify-between">
              <span className="text-sm text-(--sea-ink)">
                {formatCameraName(cam.name)}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={cam.enabled}
                aria-label={`Notifications for ${formatCameraName(cam.name)}`}
                onClick={() => onToggle(cam.name, !cam.enabled)}
                className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center px-1"
              >
                <span
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    cam.enabled ? 'bg-emerald-500' : 'bg-(--chip-line)'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                      cam.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
