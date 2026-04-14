import { Link } from '@tanstack/react-router'
import { findEventById } from '../../data/camera-events'
import type { CameraEvent } from '../../data/camera-events'

type EventDetailContent =
  | { found: true; heading: string; camera: string; timestamp: string; backPath: string }
  | { found: false; heading: string; backPath: string }

export function getEventDetailContent(
  event: CameraEvent | undefined,
): EventDetailContent {
  if (!event) {
    return { found: false, heading: 'Event not found', backPath: '/camera-events' }
  }
  return {
    found: true,
    heading: event.title,
    camera: event.camera,
    timestamp: event.timestamp,
    backPath: '/camera-events',
  }
}

export function CameraEventDetailPage({ id }: { id: string }) {
  const event = findEventById(id)
  const content = getEventDetailContent(event)

  if (!content.found) {
    return (
      <main id="main-content" className="page-wrap px-4 py-12">
        <section className="island-shell rise-in rounded-4xl px-6 py-10 text-center sm:px-10 sm:py-14">
          <p className="island-kicker mb-3">Camera Events</p>
          <h1 className="display-title mb-5 text-4xl font-bold text-(--sea-ink) sm:text-6xl">
            {content.heading}
          </h1>
          <p className="mx-auto mb-8 max-w-md text-base text-(--sea-ink-soft) sm:text-lg">
            The event you're looking for doesn't exist or has been removed.
          </p>
          <Link
            to="/camera-events"
            className="inline-flex min-h-11 items-center rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
          >
            Back to Camera Events
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <div className="mb-6">
        <Link
          to="/camera-events"
          className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-(--lagoon-deep) no-underline transition hover:text-(--sea-ink)"
        >
          &larr; Back to Camera Events
        </Link>
      </div>

      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">{content.camera}</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          {content.heading}
        </h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-(--line) bg-(--surface) p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
              Camera
            </dt>
            <dd className="mt-1 text-base font-medium text-(--sea-ink)">
              {content.camera}
            </dd>
          </div>
          <div className="rounded-xl border border-(--line) bg-(--surface) p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
              Time
            </dt>
            <dd className="mt-1 text-base font-medium text-(--sea-ink)">
              <time dateTime={content.timestamp}>
                {new Date(content.timestamp).toLocaleString()}
              </time>
            </dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
