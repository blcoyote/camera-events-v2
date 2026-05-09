import { useState, useMemo } from 'react'
import { EventCard } from './EventCard'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { formatRelativeTime, formatLabelName, getLabelDotColor } from '../utils'

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

// Re-export utils so existing imports from this module still work
export { formatRelativeTime, formatLabelName, getLabelDotColor }

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
    <main
      id="main-content"
      aria-busy="true"
      className="page-wrap px-4 pb-8 pt-6 sm:pt-14"
    >
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <p className="island-kicker mb-1">Camera Events</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Loading events…
        </h1>
      </section>
      <p className="sr-only" role="status">
        Loading camera events
      </p>
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
  favoriteEventIds,
}: {
  result: FrigateResult<FrigateEvent[]>
  favoriteEventIds: string[]
}) {
  const state = getEventsPageState(result)
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [cameraFilter, setCameraFilter] = useState<string | null>(null)

  const favoriteIdSet = useMemo(
    () => new Set(favoriteEventIds),
    [favoriteEventIds],
  )
  const events = state.kind === 'events' ? state.events : []
  const labels = getUniqueLabels(events)
  const cameras = getUniqueCameras(events)
  const filtered = filterEvents(events, labelFilter, cameraFilter)
  const labelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    events.forEach((e) => counts.set(e.label, (counts.get(e.label) ?? 0) + 1))
    return counts
  }, [events])

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      {/* Hero header */}
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-1">Camera Events</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Recent Events
        </h1>
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
                    onClick={() => setLabelFilter(labelFilter === l ? null : l)}
                    count={labelCounts.get(l) ?? 0}
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
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  isFavorited={favoriteIdSet.has(event.id)}
                />
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
                className="mt-2 min-h-11 text-sm font-medium text-(--lagoon-deep) hover:text-(--sea-ink)"
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
