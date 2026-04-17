import {
  useEventLimit,
  MIN_EVENT_LIMIT,
  MAX_EVENT_LIMIT,
  EVENT_LIMIT_STEP,
} from '#/features/shared/hooks/useEventLimit'
import { useTheme } from '#/features/shared/hooks/useTheme'
import type { ThemeMode } from '#/features/shared/hooks/useTheme'
import { NotificationSettings } from './NotificationSettings'

export function getSettingsContent(): { heading: string; description: string } {
  return {
    heading: 'Settings',
    description: 'Account preferences and camera configuration.',
  }
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'System' },
]

export function SettingsPage() {
  const content = getSettingsContent()
  const [eventLimit, setEventLimit] = useEventLimit()
  const { mode, setTheme } = useTheme()

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-1">Account</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          {content.heading}
        </h1>
      </section>

      <section className="island-shell mt-6 rounded-4xl px-6 py-8 sm:px-10 sm:py-10">
        <h2 className="mb-6 text-lg font-semibold text-(--sea-ink)">
          Appearance
        </h2>
        <fieldset>
          <legend className="text-sm font-medium text-(--sea-ink)">
            Theme
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                aria-pressed={mode === opt.value}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  mode === opt.value
                    ? 'border-[rgba(50,143,151,0.4)] bg-[rgba(79,184,178,0.18)] text-(--lagoon-deep)'
                    : 'border-(--chip-line) bg-(--chip-bg) text-(--sea-ink-soft) hover:text-(--sea-ink)'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="island-shell mt-6 rounded-4xl px-6 py-8 sm:px-10 sm:py-10">
        <h2 className="mb-6 text-lg font-semibold text-(--sea-ink)">
          Camera Events
        </h2>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="event-limit-slider"
            className="text-sm font-medium text-(--sea-ink)"
          >
            Number of events to display
          </label>
          <div className="flex items-center gap-4">
            <input
              id="event-limit-slider"
              type="range"
              min={MIN_EVENT_LIMIT}
              max={MAX_EVENT_LIMIT}
              step={EVENT_LIMIT_STEP}
              value={eventLimit}
              onChange={(e) => setEventLimit(Number(e.target.value))}
              aria-label="Number of events to display"
              aria-describedby="event-limit-desc"
              aria-valuemin={MIN_EVENT_LIMIT}
              aria-valuemax={MAX_EVENT_LIMIT}
              aria-valuenow={eventLimit}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-(--chip-line) accent-(--sea-accent)"
            />
            <span
              className="min-w-16 rounded-lg border border-(--chip-line) bg-(--chip-bg) px-3 py-1.5 text-center text-sm font-medium text-(--sea-ink) tabular-nums"
              aria-live="polite"
            >
              {eventLimit} events
            </span>
          </div>
          <p id="event-limit-desc" className="text-xs text-(--sea-ink-soft)">
            Controls how many events are loaded on the Camera Events page.
            Range: {MIN_EVENT_LIMIT}–{MAX_EVENT_LIMIT}.
          </p>
        </div>
      </section>
      <NotificationSettings />
    </main>
  )
}
