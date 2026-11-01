import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import type { ComponentProps, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/features/shared/components/ui/button'
import { Card } from '#/features/shared/components/ui/card'
import { Clock, MapPin, Gauge } from 'lucide-react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import {
  formatRelativeTime,
  getLabelDotColor,
  formatCameraName,
} from '#/features/shared/utils/eventFormatting'
import { SnapshotLightbox } from '#/features/shared/components/SnapshotLightbox'
import { EventSnapshot } from '../components/EventSnapshot'
import { EventClipPlayer } from '../components/EventClipPlayer'
import { InfoCard } from '../components/InfoCard'
import { DownloadActions } from '../components/DownloadActions'
import { BurstNav } from '../components/BurstNav'
import { useCameraNeighbors } from '../hooks/useCameraNeighbors'
import { ShareButton } from '../components/ShareButton'
import { SharedByRow } from '../components/SharedByRow'
import { parseEventStartTimeMs } from '../utils/eventId'
import { useFavoriteToggle } from '#/features/shared/hooks/useFavoriteToggle'
import { FavoriteButton } from '#/features/shared/components/FavoriteButton'
import { formatDateTime, formatPercent } from '#/features/shared/utils/intl'

// ─── Pure functions (exported for testing) ───

type DetailPageState =
  | { kind: 'event'; event: FrigateEvent }
  | { kind: 'pending' }
  | { kind: 'ghost' }
  | { kind: 'gone' }
  | { kind: 'unreachable' }

/**
 * How long after an event's start a 404 is read as "Frigate hasn't written the
 * row yet" rather than "this event does not exist".
 *
 * Frigate publishes the `"new"` MQTT message that triggers our push *before*
 * it inserts the event row — the insert only happens once the tracked object
 * has a clip or a snapshot. Tapping the notification fast enough can therefore
 * beat the write. Past this window the row is not coming, so the honest answer
 * is "not found".
 */
const PENDING_EVENT_WINDOW_MS = 120_000

// shortcut: a 404 for a recent event is read as "never saved" (Frigate dropped it as a false positive); older 404s as "cleaned up". Frigate exposes no way to tell them apart.
const GHOST_WINDOW_MS = 24 * 60 * 60 * 1000

/** How often the pending state re-asks Frigate for the event. */
const PENDING_RETRY_INTERVAL_MS = 3_000

export function getDetailPageState(
  result: FrigateResult<FrigateEvent>,
  eventId: string,
  nowMs: number,
): DetailPageState {
  if (!result.ok) {
    if (result.status === 400) return { kind: 'gone' }
    if (result.status === 404) {
      const startedAt = parseEventStartTimeMs(eventId)
      if (
        startedAt !== null &&
        nowMs - startedAt >= 0 &&
        nowMs - startedAt < PENDING_EVENT_WINDOW_MS
      ) {
        return { kind: 'pending' }
      }
      if (
        startedAt !== null &&
        nowMs - startedAt >= 0 &&
        nowMs - startedAt < GHOST_WINDOW_MS
      ) {
        return { kind: 'ghost' }
      }
      return { kind: 'gone' }
    }
    return { kind: 'unreachable' }
  }
  return { kind: 'event', event: result.data }
}

export function formatTimestamp(unixSeconds: number): string {
  return formatDateTime(unixSeconds, getLocale())
}

export function formatDuration(startTime: number, endTime: number): string {
  const diff = Math.round(endTime - startTime)
  if (diff < 60) return m.details_duration_seconds({ seconds: diff })
  const minutes = Math.floor(diff / 60)
  const seconds = diff % 60
  return seconds > 0
    ? m.details_duration_minutes_seconds({ minutes, seconds })
    : m.details_duration_minutes({ minutes })
}

/**
 * Poll for an event Frigate has not finished writing yet.
 *
 * The deadline is anchored at mount rather than recomputed per tick so the
 * polling cannot outlive the window even if a retry never lands — a stuck
 * loader must not turn into an indefinite drip of requests at Frigate.
 *
 * Retries are serialized: the caller's handler re-runs the route loader, which
 * waits on Frigate for up to its full request timeout, so a fixed interval
 * would otherwise stack refetches on a slow instance. A rejected retry is
 * swallowed — nothing awaits it — and releases the guard so a single failure
 * cannot wedge the poller.
 */
function usePendingEventRetry(
  active: boolean,
  eventId: string,
  nowMs: number,
  onRetry?: () => void | Promise<void>,
): void {
  const startedAt = parseEventStartTimeMs(eventId)
  const remainingMs =
    startedAt === null ? 0 : PENDING_EVENT_WINDOW_MS - (nowMs - startedAt)

  // Callers pass an inline handler, so its identity changes on every render.
  // Reading it through a ref keeps the interval from being torn down and
  // restarted each time — which would otherwise stop it ever elapsing.
  const retryRef = useRef(onRetry)
  useEffect(() => {
    retryRef.current = onRetry
  })

  const canRetry = !!onRetry

  useEffect(() => {
    if (!active || !canRetry || remainingMs <= 0) return

    const deadline = Date.now() + remainingMs
    let inFlight = false

    const timer = setInterval(() => {
      if (Date.now() >= deadline) {
        clearInterval(timer)
        // One last look so the loader re-stamps loadedAt and the page moves on.
        // An in-flight retry re-stamps it itself, so don't stack another.
        if (!inFlight)
          void Promise.resolve(retryRef.current?.()).catch(() => {})
        return
      }
      if (inFlight) return

      inFlight = true
      void Promise.resolve(retryRef.current?.())
        .catch(() => {})
        .finally(() => {
          inFlight = false
        })
    }, PENDING_RETRY_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [active, canRetry, remainingMs])
}

// ─── Components ───

function StateCard({
  title,
  body,
  actions,
  live,
}: {
  title: string
  body: string
  actions: ReactNode
  live?: boolean
}) {
  return (
    <main id="main-content" className="page-wrap px-4 py-6 sm:py-12">
      <div role={live ? 'status' : undefined}>
        <Card className="rise-in block px-5 py-6 text-center sm:px-8 sm:py-8">
          <h1 className="mb-3 text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mx-auto mb-6 max-w-md text-base text-fg-2 sm:text-lg">
            {body}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        </Card>
      </div>
    </main>
  )
}

function EventDetailContent({
  result,
  eventId: requestedEventId = '',
  nowMs,
  onRetry,
  initialFavorited = false,
  sharedBy = [],
  onRemoveShare,
}: {
  result: FrigateResult<FrigateEvent>
  /** The ID that was requested — the only handle we have when the load 404s. */
  eventId?: string
  /**
   * When the result was loaded, as epoch ms. Supplied by the route loader so
   * the server and the client agree on the event's age at first paint; falling
   * back to a render-time clock would risk a hydration mismatch.
   */
  nowMs?: number
  /** Re-runs the loader. Drives the pending state's retries. */
  onRetry?: () => void | Promise<void>
  initialFavorited?: boolean
  /** Names of the people who shared this event with the viewer. */
  sharedBy?: (string | null)[]
  onRemoveShare?: () => Promise<void>
}) {
  const [fallbackNow] = useState(() => Date.now())
  const state = getDetailPageState(
    result,
    requestedEventId,
    nowMs ?? fallbackNow,
  )
  const [lightboxOpen, setLightboxOpen] = useState(false)
  // Call hook unconditionally (React rules) — use empty string as sentinel in error branch
  const eventId = state.kind === 'event' ? state.event.id : ''
  const {
    favorited,
    pending,
    error: favoriteError,
    toggle,
  } = useFavoriteToggle(eventId, initialFavorited)

  const neighbors = useCameraNeighbors(
    state.kind === 'event' ? state.event : null,
  )

  const headingRef = useRef<HTMLHeadingElement>(null)
  const prevKind = useRef(state.kind)
  useEffect(() => {
    if (prevKind.current === 'pending' && state.kind === 'event') {
      headingRef.current?.focus()
    }
    prevKind.current = state.kind
  }, [state.kind])

  usePendingEventRetry(
    state.kind === 'pending',
    requestedEventId,
    nowMs ?? fallbackNow,
    onRetry,
  )

  if (state.kind !== 'event') {
    const back = (
      <Button
        asChild
        variant={
          state.kind === 'ghost' || state.kind === 'gone' ? 'default' : 'ghost'
        }
      >
        <Link to="/camera-events" className="no-underline">
          {m.details_back()}
        </Link>
      </Button>
    )
    const copy = {
      pending: [m.details_pending_title(), m.details_pending_body()],
      ghost: [m.details_ghost_title(), m.details_ghost_body()],
      gone: [m.details_gone_title(), m.details_gone_body()],
      unreachable: [
        m.details_unreachable_title(),
        m.details_unreachable_body(),
      ],
    }[state.kind]
    const retryLabel =
      state.kind === 'pending'
        ? m.details_check_again()
        : state.kind === 'unreachable'
          ? m.details_try_again()
          : null
    return (
      <StateCard
        title={copy[0]}
        body={copy[1]}
        live={state.kind === 'pending'}
        actions={
          <>
            {retryLabel && onRetry && (
              <Button onClick={onRetry}>{retryLabel}</Button>
            )}
            {back}
          </>
        }
      />
    )
  }

  const { event } = state
  const dotColor = getLabelDotColor(event.label)

  const snapshotSrc = `/api/events/${event.id}/snapshot`
  const zoom = () => setLightboxOpen(true)
  const snapshot = event.has_snapshot ? (
    <EventSnapshot
      eventId={event.id}
      camera={event.camera}
      label={event.label}
      onZoom={zoom}
    />
  ) : undefined
  const snapshotAlt = m.details_snapshot_alt({
    label: translateLabel(event.label, getLocale()),
    camera: formatCameraName(event.camera),
  })

  return (
    <main id="main-content" className="page-wrap pb-8 pt-4 sm:pt-14">
      <div className="mb-6 hidden sm:block">
        <Link
          to="/camera-events"
          className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-brand-strong no-underline transition hover:text-foreground"
        >
          &larr; {m.details_back()}
        </Link>
      </div>

      <section className="rise-in relative sm:glass sm:overflow-hidden sm:rounded-card sm:px-8 sm:py-8">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 flex max-w-3xl items-center gap-3 text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl"
        >
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
          {translateLabel(event.label, getLocale())}
          {event.sub_label && (
            <span className="text-xl font-normal text-fg-2 sm:text-2xl">
              — {event.sub_label}
            </span>
          )}
        </h1>

        <p className="mb-6 text-sm text-muted-foreground">
          {formatCameraName(event.camera)} ·{' '}
          {formatRelativeTime(event.start_time, nowMs ?? fallbackNow)} ·{' '}
          {formatTimestamp(event.start_time)}
        </p>
        {onRemoveShare && (
          <SharedByRow sharedBy={sharedBy} onRemove={onRemoveShare} />
        )}

        {(event.has_clip || event.has_snapshot) && (
          <div className="-mx-4 mb-6 sm:mx-0 sm:mb-8">
            {event.has_clip ? (
              <EventClipPlayer
                eventId={event.id}
                camera={event.camera}
                label={event.label}
                poster={event.has_snapshot ? snapshotSrc : undefined}
                fallback={snapshot}
                onZoom={event.has_snapshot ? zoom : undefined}
              />
            ) : (
              snapshot
            )}
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2 sm:mb-6">
          <FavoriteButton
            showLabel
            eventId={event.id}
            favorited={favorited}
            pending={pending}
            error={favoriteError}
            onToggle={toggle}
          />
          <ShareButton
            showLabel
            eventId={event.id}
            label={event.label}
            startTime={event.start_time}
          />
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="min-h-11 gap-2 px-4"
          >
            <Link to="/live/$name" params={{ name: event.camera }}>
              <span
                className="live-pulse size-2.5 rounded-full bg-danger"
                aria-hidden
              />
              {m.details_watch_live()}
            </Link>
          </Button>
        </div>

        <div className="mb-6 sm:mb-8">
          <BurstNav camera={event.camera} {...neighbors} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-0 divide-y divide-border-soft sm:mt-6 sm:grid-cols-2 sm:gap-4 sm:divide-y-0 lg:grid-cols-3">
          <InfoCard
            icon={Clock}
            label={m.details_duration()}
            value={formatDuration(event.start_time, event.end_time)}
          />
          {event.zones.length > 0 && (
            <InfoCard
              icon={MapPin}
              label={m.details_zones()}
              value={event.zones.map(formatCameraName).join(', ')}
            />
          )}
          {event.data.score > 0 && (
            <InfoCard
              icon={Gauge}
              label={m.details_confidence()}
              value={formatPercent(event.data.score, getLocale())}
            />
          )}
        </dl>

        <DownloadActions
          eventId={event.id}
          hasClip={event.has_clip}
          hasSnapshot={event.has_snapshot}
        />
      </section>

      {event.has_snapshot && (
        <SnapshotLightbox
          src={snapshotSrc}
          alt={snapshotAlt}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  )
}

export function CameraEventDetailPage(
  props: ComponentProps<typeof EventDetailContent>,
) {
  // Prev/Next only changes the route param, so key by event to reset per-event state.
  return <EventDetailContent key={props.eventId ?? ''} {...props} />
}
