export function AvailabilityAlertsToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-(--chip-line) pt-5">
      <div>
        <p className="text-sm font-medium text-(--sea-ink)">
          Camera Offline Alerts
        </p>
        <p className="mt-0.5 text-xs text-(--sea-ink-soft)">
          Get notified when a camera stops sending video or comes back online.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Camera offline alerts"
        onClick={() => onToggle(!enabled)}
        className="relative inline-flex min-h-11 shrink-0 cursor-pointer items-center px-1"
      >
        <span
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
            enabled ? 'bg-emerald-500' : 'bg-(--chip-line)'
          }`}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
      </button>
    </div>
  )
}
