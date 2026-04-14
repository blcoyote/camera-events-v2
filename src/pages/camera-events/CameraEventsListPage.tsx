import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Video } from 'lucide-react'
import type { FrigateResult } from '../../server/frigate/config'
import type { FrigateEvent } from '../../server/frigate/types'

// ─── Pure functions (exported for testing) ───

type EventsPageState =
  | { kind: 'events'; events: FrigateEvent[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

export function getEventsPageState(
  result: FrigateResult<FrigateEvent[]>,
): EventsPageState {
  if (!result.ok) {
    return {
      kind: 'error',
      message: 'Could not load events. Check that Frigate is running.',
    }
  }
  if (result.data.length === 0) {
    return { kind: 'empty' }
  }
  return { kind: 'events', events: result.data }
}

export function getUniqueLabels(events: FrigateEvent[]): string[] {
  return [...new Set(events.map((e) => e.label))].sort()
}

export function getUniqueCameras(events: FrigateEvent[]): string[] {
  return [...new Set(events.map((e) => e.camera))].sort()
}

export function filterEvents(
  events: FrigateEvent[],
  label: string | null,
  camera: string | null,
): FrigateEvent[] {
  return events.filter((e) => {
    if (label && e.label !== label) return false
    if (camera && e.camera !== camera) return false
    return true
  })
}

export function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now() / 1000
  const diff = now - unixSeconds
  if (diff < 0) return 'Just now'
  if (diff < 60) return 'Just now'
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins}m ago`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours}h ago`
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400)
    return `${days}d ago`
  }
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatLabelName(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const LABEL_DOT_COLORS: Record<string, string> = {
  person: '#4fb8b2',
  car: '#f59e0b',
  truck: '#f59e0b',
  motorcycle: '#f59e0b',
  bicycle: '#d97706',
  bus: '#f59e0b',
  dog: '#22c55e',
  cat: '#22c55e',
  bird: '#34d399',
  bear: '#16a34a',
  package: '#818cf8',
}

export function getLabelDotColor(label: string): string {
  return LABEL_DOT_COLORS[label] ?? '#94a3b8'
}

// ─── Sub-components ───

function FilterPill({
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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
        active
          ? 'border-[rgba(50,143,151,0.4)] bg-[rgba(79,184,178,0.18)] text-(--lagoon-deep)'
          : 'border-(--chip-line) bg-(--chip-bg) text-(--sea-ink-soft) hover:text-(--sea-ink)'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="text-xs opacity-60">{count}</span>
      )}
    </button>
  )
}

function EventThumbnail({ eventId }: { eventId: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex aspect-video items-center justify-center bg-(--surface) text-(--sea-ink-soft)">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="opacity-40"
        >
          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
          <rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
        </svg>
      </div>
    )
  }

  return (
    <img
      src={`/api/events/${eventId}/thumbnail`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  )
}

function EventCard({ event, index }: { event: FrigateEvent; index: number }) {
  const isRecent = Date.now() / 1000 - event.start_time < 300
  const cappedDelay = Math.min(index, 11)

  return (
    <Link
      to="/camera-events/$id"
      params={{ id: event.id }}
      className="event-card event-card-enter group block no-underline"
      style={{ '--i': cappedDelay } as React.CSSProperties}
      aria-label={`${formatLabelName(event.label)} detected by ${event.camera}, ${formatRelativeTime(event.start_time)}`}
    >
      <div className="event-thumb aspect-video">
        <EventThumbnail eventId={event.id} />

        {/* Label badge */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: getLabelDotColor(event.label) }}
              aria-hidden="true"
            />
            {formatLabelName(event.label)}
          </span>
          {event.sub_label && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {event.sub_label}
            </span>
          )}
        </div>

        {/* Status indicators */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {isRecent && (
            <span
              className="live-pulse h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
              role="img"
              aria-label="Recent event"
            />
          )}
          {event.has_clip && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
              role="img"
              aria-label="Has video clip"
            >
              <Video size={12} className="text-white" aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="event-meta-fade pointer-events-none absolute inset-x-0 bottom-0 h-16" />
      </div>

      {/* Card metadata */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-(--sea-ink)">
            {event.camera}
          </p>
          <time
            dateTime={new Date(event.start_time * 1000).toISOString()}
            className="shrink-0 text-xs text-(--sea-ink-soft)"
            suppressHydrationWarning
          >
            {formatRelativeTime(event.start_time)}
          </time>
        </div>

        {event.zones.length > 0 && (
          <p className="mt-1 truncate text-xs text-(--sea-ink-soft)">
            {event.zones.join(' · ')}
          </p>
        )}
      </div>
    </Link>
  )
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="event-card event-card-enter overflow-hidden"
      style={{ '--i': Math.min(index, 5) } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="skeleton-shimmer aspect-video" />
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="skeleton-shimmer h-4 w-24 rounded" />
          <div className="skeleton-shimmer h-3 w-14 rounded" />
        </div>
        <div className="skeleton-shimmer h-3 w-16 rounded" />
      </div>
    </div>
  )
}

// ─── Exported page components ───

export function CameraEventsLoading() {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Camera Events</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Loading events…
        </h1>
      </section>
      <section
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Loading events"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </section>
    </main>
  )
}

export function CameraEventsListPage({
  result,
}: {
  result: FrigateResult<FrigateEvent[]>
}) {
  const state = getEventsPageState(result)
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [cameraFilter, setCameraFilter] = useState<string | null>(null)

  const events = state.kind === 'events' ? state.events : []
  const labels = getUniqueLabels(events)
  const cameras = getUniqueCameras(events)
  const filtered = filterEvents(events, labelFilter, cameraFilter)

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      {/* Hero header */}
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Camera Events</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Recent Events
        </h1>
        <p className="mb-0 max-w-2xl text-base text-(--sea-ink-soft) sm:text-lg">
          Motion, person, and vehicle detection events from your cameras.
        </p>
      </section>

      {/* Error state */}
      {state.kind === 'error' && (
        <div
          role="alert"
          className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message}
        </div>
      )}

      {/* Empty state */}
      {state.kind === 'empty' && (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-(--sea-ink)">
            No events recorded
          </p>
          <p className="mt-1 text-sm text-(--sea-ink-soft)">
            Events will appear here when your cameras detect activity.
          </p>
        </div>
      )}

      {/* Filters + Grid */}
      {state.kind === 'events' && (
        <>
          {/* Filter bar */}
          <div className="mt-6 space-y-3">
            {labels.length > 1 && (
              <div
                role="group"
                aria-label="Filter by detection type"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <FilterPill
                  label="All types"
                  active={labelFilter === null}
                  onClick={() => setLabelFilter(null)}
                  count={events.length}
                />
                {labels.map((l) => (
                  <FilterPill
                    key={l}
                    label={formatLabelName(l)}
                    active={labelFilter === l}
                    onClick={() =>
                      setLabelFilter(labelFilter === l ? null : l)
                    }
                    count={events.filter((e) => e.label === l).length}
                  />
                ))}
              </div>
            )}
            {cameras.length > 1 && (
              <div
                role="group"
                aria-label="Filter by camera"
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <FilterPill
                  label="All cameras"
                  active={cameraFilter === null}
                  onClick={() => setCameraFilter(null)}
                />
                {cameras.map((c) => (
                  <FilterPill
                    key={c}
                    label={c}
                    active={cameraFilter === c}
                    onClick={() =>
                      setCameraFilter(cameraFilter === c ? null : c)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Results count */}
          <p
            className="mt-4 text-xs font-medium text-(--sea-ink-soft)"
            aria-live="polite"
          >
            {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
            {(labelFilter || cameraFilter) && ' (filtered)'}
          </p>

          {/* Event grid */}
          {filtered.length > 0 ? (
            <section
              aria-label="Camera events"
              className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filtered.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </section>
          ) : (
            <div className="mt-8 text-center">
              <p className="text-sm text-(--sea-ink-soft)">
                No events match the selected filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setLabelFilter(null)
                  setCameraFilter(null)
                }}
                className="mt-2 text-sm font-medium text-(--lagoon-deep) hover:text-(--sea-ink)"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
