import { m } from '#/paraglide/messages.js'
import { getLocale } from '#/paraglide/runtime.js'
import { translateLabel } from '#/features/shared/utils/labels'
import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/features/shared/components/ui/button'
import { Card } from '#/features/shared/components/ui/card'
import { Progress } from '#/features/shared/components/ui/progress'
import { Camera, Clock, MapPin, Film, Image } from 'lucide-react'
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
import { parseEventStartTimeMs } from '../utils/eventId'
import { useFavoriteToggle } from '#/features/shared/hooks/useFavoriteToggle'
import { FavoriteButton } from '#/features/shared/components/FavoriteButton'
import { formatDateTime, formatPercent } from '#/features/shared/utils/intl'

// ─── Pure functions (exported for testing) ───

type DetailPageState =
  | { kind: 'event'; event: FrigateEvent }
  | { kind: 'pending' }
  | { kind: 'error'; message: string }

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

/** How often the pending state re-asks Frigate for the event. */
const PENDING_RETRY_INTERVAL_MS = 3_000

export function getDetailPageState(
  result: FrigateResult<FrigateEvent>,
  eventId: string,
  nowMs: number,
): DetailPageState {
  if (!result.ok) {
    if (result.status === 404) {
      const startedAt = parseEventStartTimeMs(eventId)
      if (
        startedAt !== null &&
        nowMs - startedAt >= 0 &&
        nowMs - startedAt < PENDING_EVENT_WINDOW_MS
      ) {
        return { kind: 'pending' }
      }
      return {
        kind: 'error',
        message: m.details_not_found_body(),
      }
    }
    return {
      kind: 'error',
      message: m.details_load_error(),
    }
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

export function getDownloadUrl(
  eventId: string,
  kind: 'clip' | 'snapshot',
): string {
  const extension = kind === 'clip' ? 'clip' : 'snapshot'
  return `/api/events/${eventId}/${extension}?download=true`
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

export function CameraEventDetailPage({
  result,
  eventId: requestedEventId = '',
  nowMs,
  onRetry,
  initialFavorited = false,
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
}) {
  const [fallbackNow] = useState(() => Date.now())
  const state = getDetailPageState(
    result,
    requestedEventId,
    nowMs ?? fallbackNow,
  )
  const [lightboxOpen, setLightboxOpen] = useState(false)
  // The clip is the answer to the notification, so the accordion starts open
  // and the player mounts immediately (preload='metadata' keeps cost low).
  // Stays mounted when collapsed so re-expanding is instant.
  const [clipAccordionOpened, setClipAccordionOpened] = useState(true)
  // Browsers may fire 'toggle' for an initially-open <details>; only scroll
  // once the user has closed it at least once (i.e. on a user-initiated open).
  const clipClosedOnce = useRef(false)
  // Call hook unconditionally (React rules) — use empty string as sentinel in error branch
  const eventId = state.kind === 'event' ? state.event.id : ''
  const {
    favorited,
    pending,
    error: favoriteError,
    toggle,
  } = useFavoriteToggle(eventId, initialFavorited)

  usePendingEventRetry(
    state.kind === 'pending',
    requestedEventId,
    nowMs ?? fallbackNow,
    onRetry,
  )

  if (state.kind === 'pending') {
    return (
      <main id="main-content" className="page-wrap px-4 py-6 sm:py-12">
        <Card className="rise-in block px-5 py-6 text-center sm:px-8 sm:py-8">
          <p className="eyebrow mb-1">{m.app_name()}</p>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl">
            {m.details_pending_title()}
          </h1>
          <p className="mx-auto mb-6 max-w-md text-base text-fg-2 sm:text-lg">
            {m.details_pending_body()}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={onRetry}>{m.details_check_again()}</Button>
            <Button asChild variant="ghost">
              <Link to="/camera-events" className="no-underline">
                {m.details_back()}
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  if (state.kind === 'error') {
    return (
      <main id="main-content" className="page-wrap px-4 py-6 sm:py-12">
        <Card className="rise-in block px-5 py-6 text-center sm:px-8 sm:py-8">
          <p className="eyebrow mb-1">{m.app_name()}</p>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl">
            {m.details_not_found_title()}
          </h1>
          <p className="mx-auto mb-6 max-w-md text-base text-fg-2 sm:text-lg">
            {state.message}
          </p>
          <Button asChild>
            <Link to="/camera-events" className="no-underline">
              {m.details_back()}
            </Link>
          </Button>
        </Card>
      </main>
    )
  }

  const { event } = state
  const dotColor = getLabelDotColor(event.label)

  const snapshotSrc = `/api/events/${event.id}/snapshot`
  const snapshotAlt = m.details_snapshot_alt({
    label: translateLabel(event.label, getLocale()),
    camera: formatCameraName(event.camera),
  })

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <div className="mb-6">
        <Link
          to="/camera-events"
          className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-brand-strong no-underline transition hover:text-foreground"
        >
          &larr; {m.details_back()}
        </Link>
      </div>

      <section className="rise-in relative overflow-hidden sm:glass sm:rounded-card sm:px-8 sm:py-8">
        <p className="eyebrow mb-1">{formatCameraName(event.camera)}</p>

        <h1 className="mb-2 flex max-w-3xl items-center gap-3 text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl">
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

        <div className="mb-6 flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {formatRelativeTime(event.start_time)} ·{' '}
            {formatTimestamp(event.start_time)}
          </p>
          <FavoriteButton
            eventId={event.id}
            favorited={favorited}
            pending={pending}
            error={favoriteError}
            onToggle={toggle}
          />
        </div>

        {event.has_snapshot && (
          <>
            <div className="-mx-4 mb-6 sm:mx-0 sm:mb-8">
              <EventSnapshot
                eventId={event.id}
                camera={event.camera}
                label={event.label}
                onZoom={() => setLightboxOpen(true)}
              />
            </div>
          </>
        )}

        {event.has_clip && (
          <details
            open
            className="-mx-4 mb-6 overflow-hidden border-y border-border-soft bg-card sm:mx-0 sm:mb-8 sm:rounded-card sm:border"
            onToggle={(e) => {
              if (!e.currentTarget.open) {
                clipClosedOnce.current = true
              } else if (clipClosedOnce.current) {
                setClipAccordionOpened(true)
                const target = e.currentTarget
                requestAnimationFrame(() => {
                  if (typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }
                })
              }
            }}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-7 py-3 text-sm font-semibold text-brand-strong transition hover:bg-surface-hover sm:px-4">
              <Film className="h-4 w-4" aria-hidden="true" />
              {m.details_watch_clip()}
            </summary>
            {clipAccordionOpened && (
              <div className="border-t border-border-soft">
                <EventClipPlayer
                  eventId={event.id}
                  camera={event.camera}
                  label={event.label}
                  onError={() => {
                    // Defensive: snapshot block renders independently of
                    // player state. Hook is kept so a future layout that
                    // hides the snapshot behind the player can re-reveal it.
                  }}
                />
              </div>
            )}
          </details>
        )}

        <dl className="mt-4 grid grid-cols-1 gap-0 divide-y divide-border-soft sm:mt-6 sm:grid-cols-2 sm:gap-4 sm:divide-y-0 lg:grid-cols-3">
          <InfoCard
            icon={Camera}
            label={m.details_camera()}
            value={formatCameraName(event.camera)}
          />
          <InfoCard
            icon={Clock}
            label={m.details_duration()}
            value={formatDuration(event.start_time, event.end_time)}
          />
          {event.zones.length > 0 && (
            <InfoCard
              icon={MapPin}
              label={m.details_zones()}
              value={event.zones.join(', ')}
            />
          )}
          <InfoCard
            icon={Film}
            label={m.details_clip()}
            value={event.has_clip ? m.details_available() : m.details_none()}
            downloadUrl={
              event.has_clip ? getDownloadUrl(event.id, 'clip') : undefined
            }
            aria-label={event.has_clip ? m.details_download_clip() : undefined}
          />
          <InfoCard
            icon={Image}
            label={m.details_snapshot()}
            value={
              event.has_snapshot ? m.details_available() : m.details_none()
            }
            downloadUrl={
              event.has_snapshot
                ? getDownloadUrl(event.id, 'snapshot')
                : undefined
            }
            aria-label={
              event.has_snapshot ? m.details_download_snapshot() : undefined
            }
          />
        </dl>

        {event.data.score > 0 && (
          <div className="mt-4 border-t border-border-soft pt-4 sm:glass-flat sm:mt-6 sm:rounded-input sm:p-4 sm:pt-4">
            <h2 className="eyebrow mb-2 text-muted-foreground">
              {m.details_confidence()}
            </h2>
            <div className="flex items-center gap-3">
              <Progress
                className="flex-1"
                value={Math.round(event.data.score * 100)}
                aria-label={m.details_confidence()}
              />
              <span className="text-sm font-semibold text-foreground">
                {formatPercent(event.data.score, getLocale())}
              </span>
            </div>
          </div>
        )}
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
