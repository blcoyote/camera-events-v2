import { useState } from 'react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { formatLabelName } from '#/features/shared/utils/eventFormatting'
import { FilterPill } from '../components/FilterPill'
import { EventCard } from '#/features/shared/components/EventCard'

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

// ─── Exported page components ───

export function CameraEventsListPage({
  result,
  favoritedIds = new Set<string>(),
}: {
  result: FrigateResult<FrigateEvent[]>
  favoritedIds?: Set<string>
}) {
  const state = getEventsPageState(result)
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [cameraFilter, setCameraFilter] = useState<string | null>(null)

  const events = state.kind === 'events' ? state.events : []
  const labels = getUniqueLabels(events)
  const cameras = getUniqueCameras(events)
  const filtered = filterEvents(events, labelFilter, cameraFilter)

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      {/* Hero header */}
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)]" />
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
                <EventCard
                  key={event.id}
                  event={event}
                  index={i}
                  initialFavorited={favoritedIds.has(event.id)}
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
