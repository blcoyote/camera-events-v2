import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { useId } from 'react'
import { dayKey, formatDate } from '#/features/shared/utils/intl'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { FilterPill } from '#/features/shared/components/FilterPill'
import { EventCard } from '#/features/shared/components/EventCard'
import { NativeSelect } from '#/features/shared/components/ui/native-select'
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

function countBy(items: string[]) {
  const counts = new Map<string, number>()
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1)
  return counts
}

export function getLabelOptions(
  events: FrigateEvent[],
  cameraFilter: string | null,
  activeLabel: string | null,
): { label: string; count: number }[] {
  const counts = countBy(
    events
      .filter((e) => !cameraFilter || e.camera === cameraFilter)
      .map((e) => e.label),
  )
  if (activeLabel && !counts.has(activeLabel)) counts.set(activeLabel, 0)
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function getCameraOptions(
  events: FrigateEvent[],
  labelFilter: string | null,
  activeCamera: string | null,
): { camera: string; count: number }[] {
  const counts = countBy(
    events
      .filter((e) => !labelFilter || e.label === labelFilter)
      .map((e) => e.camera),
  )
  if (activeCamera && !counts.has(activeCamera)) counts.set(activeCamera, 0)
  return [...counts]
    .map(([camera, count]) => ({ camera, count }))
    .sort((a, b) => a.camera.localeCompare(b.camera))
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

export function groupEventsByDay(events: FrigateEvent[], nowMs: number) {
  const today = dayKey(nowMs / 1000)
  const [y, mo, d] = today.split('-').map(Number)
  const yesterday = new Date(Date.UTC(y, mo - 1, d - 1))
    .toISOString()
    .slice(0, 10)
  const groups: { key: string; title: string; events: FrigateEvent[] }[] = []
  for (const e of [...events].sort((a, b) => b.start_time - a.start_time)) {
    const key = dayKey(e.start_time)
    let g = groups.at(-1)
    if (g?.key !== key) {
      const title =
        key === today
          ? m.events_section_today()
          : key === yesterday
            ? m.events_section_yesterday()
            : formatDate(e.start_time, getLocale(), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
      g = { key, title, events: [] }
      groups.push(g)
    }
    g.events.push(e)
  }
  return groups
}

// ─── Exported page components ───

export function CameraEventsListPage({
  result,
  favoritedIds = new Set<string>(),
  labelFilter,
  cameraFilter,
  onLabelFilterChange,
  onCameraFilterChange,
}: {
  result: FrigateResult<FrigateEvent[]>
  favoritedIds?: Set<string>
  labelFilter: string | null
  cameraFilter: string | null
  onLabelFilterChange: (label: string | null) => void
  onCameraFilterChange: (camera: string | null) => void
}) {
  const state = getEventsPageState(result)

  const events = state.kind === 'events' ? state.events : []
  const labels = getLabelOptions(events, cameraFilter, labelFilter)
  const cameras = getCameraOptions(events, labelFilter, cameraFilter)
  const filtered = filterEvents(events, labelFilter, cameraFilter)
  const groups = groupEventsByDay(filtered, Date.now())
  const baseId = useId()
  let index = 0

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
            {(labels.length > 1 || labelFilter) && (
              <div
                role="group"
                aria-label={m.events_filter_type_group()}
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
              >
                <FilterPill
                  label={m.events_filter_all_types()}
                  active={labelFilter === null}
                  onClick={() => onLabelFilterChange(null)}
                  count={
                    events.filter(
                      (e) => !cameraFilter || e.camera === cameraFilter,
                    ).length
                  }
                />
                {labels.map(({ label, count }) => (
                  <FilterPill
                    key={label}
                    label={translateLabel(label, getLocale())}
                    active={labelFilter === label}
                    onClick={() =>
                      onLabelFilterChange(labelFilter === label ? null : label)
                    }
                    count={count}
                  />
                ))}
              </div>
            )}
            {(cameras.length > 1 || cameraFilter) && (
              <div className="w-full sm:w-auto sm:max-w-xs">
                <NativeSelect
                  aria-label={m.events_filter_camera_group()}
                  value={cameraFilter ?? ''}
                  onChange={(e) => onCameraFilterChange(e.target.value || null)}
                >
                  <option value="">{m.events_filter_all_cameras()}</option>
                  {cameras.map(({ camera, count }) => (
                    <option key={camera} value={camera}>
                      {`${camera} (${count})`}
                    </option>
                  ))}
                </NativeSelect>
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
            <div>
              {groups.map((g, gi) => (
                <section key={g.key} aria-labelledby={`${baseId}-${g.key}`}>
                  <h2
                    id={`${baseId}-${g.key}`}
                    className={`${gi === 0 ? 'mt-4' : 'mt-6'} mb-3 text-sm font-semibold text-fg-2`}
                    suppressHydrationWarning
                  >
                    {g.title}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {g.events.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        index={index++}
                        initialFavorited={favoritedIds.has(event.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-8 text-center">
              <p className="text-sm text-fg-2">{m.events_no_match()}</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  onLabelFilterChange(null)
                  onCameraFilterChange(null)
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
