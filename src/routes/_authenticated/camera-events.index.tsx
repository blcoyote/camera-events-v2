import { createFileRoute, Link } from '@tanstack/react-router'
import { PLACEHOLDER_EVENTS } from '../../data/camera-events'
import type { CameraEvent } from '../../data/camera-events'

/**
 * Format an event into a readable one-line summary.
 */
export function formatEventSummary(event: CameraEvent): string {
  return `${event.camera}: ${event.title}`
}

export const Route = createFileRoute('/_authenticated/camera-events/')({
  component: CameraEventsListComponent,
})

function CameraEventsListComponent() {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Camera Events</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Recent Events
        </h1>
        <p className="mb-8 max-w-2xl text-base text-(--sea-ink-soft) sm:text-lg">
          View motion, person, and vehicle detection events from your cameras.
        </p>
      </section>

      <ul className="mt-8 space-y-3">
        {PLACEHOLDER_EVENTS.map((event) => (
          <li key={event.id}>
            <Link
              to="/camera-events/$id"
              params={{ id: event.id }}
              className="island-shell block rounded-2xl p-5 no-underline transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--lagoon-deep)_35%,var(--line))]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="mb-1 text-base font-semibold text-(--sea-ink)">
                    {event.title}
                  </h2>
                  <p className="m-0 text-sm text-(--sea-ink-soft)">
                    {formatEventSummary(event)}
                  </p>
                </div>
                <time
                  dateTime={event.timestamp}
                  className="shrink-0 text-xs text-(--sea-ink-soft)"
                >
                  {new Date(event.timestamp).toLocaleString()}
                </time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
