import {
  useEventLimit,
  MIN_EVENT_LIMIT,
  MAX_EVENT_LIMIT,
  EVENT_LIMIT_STEP,
} from '#/hooks/useEventLimit'
import { NotificationSettings } from './NotificationSettings'

export function getSettingsContent(): { heading: string; description: string } {
  return {
    heading: 'Settings',
    description: 'Account preferences and camera configuration.',
  }
}

export function SettingsPage() {
  const content = getSettingsContent()
  const [eventLimit, setEventLimit] = useEventLimit()

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Account</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          {content.heading}
        </h1>
        <p className="mb-8 max-w-2xl text-base text-(--sea-ink-soft) sm:text-lg">
          {content.description}
        </p>
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
          <p className="text-xs text-(--sea-ink-soft)">
            Controls how many events are loaded on the Camera Events page.
            Range: {MIN_EVENT_LIMIT}–{MAX_EVENT_LIMIT}.
          </p>
        </div>
      </section>
      <NotificationSettings />
    </main>
  )
}
