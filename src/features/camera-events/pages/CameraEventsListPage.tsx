import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { useState } from 'react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
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
      message: m.events_load_error(),
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
      <PageHeader eyebrow={m.shell_title_app()} title={m.events_page_title()} />

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
            {m.events_empty_title()}
          </p>
          <p className="mt-1 text-sm text-fg-2">{m.events_empty_hint()}</p>
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
                aria-label={m.events_filter_type_group()}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <FilterPill
                  label={m.events_filter_all_types()}
                  active={labelFilter === null}
                  onClick={() => setLabelFilter(null)}
                  count={events.length}
                />
                {labels.map((l) => (
                  <FilterPill
                    key={l}
                    label={translateLabel(l, getLocale())}
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
                aria-label={m.events_filter_camera_group()}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <FilterPill
                  label={m.events_filter_all_cameras()}
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
            {labelFilter || cameraFilter
              ? m.events_count_filtered({ count: filtered.length })
              : m.events_count({ count: filtered.length })}
          </p>

          {/* Event grid */}
          {filtered.length > 0 ? (
            <section
              aria-label={m.events_grid_label()}
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
              <p className="text-sm text-fg-2">{m.events_no_match()}</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  setLabelFilter(null)
                  setCameraFilter(null)
                }}
                className="mt-2"
              >
                {m.events_clear_filters()}
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
