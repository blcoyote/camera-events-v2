import { useState } from 'react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { formatLabelName } from '#/features/shared/utils/eventFormatting'
import { FilterPill } from '../components/FilterPill'
import { EventCard } from '#/features/shared/components/EventCard'
import { Button } from '#/features/shared/components/ui/button'
import { Alert } from '#/features/shared/components/ui/alert'
import { PageHeader } from '#/features/shared/components/PageHeader'

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
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader eyebrow="Camera Events" title="Recent Events" />

      {/* Error state */}
      {state.kind === 'error' && (
        <Alert variant="destructive" className="mx-auto mt-8 max-w-3xl">
          {state.message}
        </Alert>
      )}

      {/* Empty state */}
      {state.kind === 'empty' && (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-foreground">
            No events recorded
          </p>
          <p className="mt-1 text-sm text-fg-2">
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
            className="mt-4 text-xs font-medium text-muted-foreground"
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
              <p className="text-sm text-fg-2">
                No events match the selected filters.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setLabelFilter(null)
                  setCameraFilter(null)
                }}
                className="mt-2"
              >
                Clear filters
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
