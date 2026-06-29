import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Camera, Clock, MapPin, Film, Image } from 'lucide-react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import {
  formatRelativeTime,
  formatLabelName,
  getLabelDotColor,
  formatCameraName,
} from '#/features/shared/utils/eventFormatting'
import { SnapshotLightbox } from '../components/SnapshotLightbox'
import { EventSnapshot } from '../components/EventSnapshot'
import { EventClipPlayer } from '../components/EventClipPlayer'
import { InfoCard } from '../components/InfoCard'
import { useFavoriteToggle } from '#/features/shared/hooks/useFavoriteToggle'
import { FavoriteButton } from '#/features/shared/components/FavoriteButton'

// ─── Pure functions (exported for testing) ───

type DetailPageState =
  | { kind: 'event'; event: FrigateEvent }
  | { kind: 'error'; message: string }

export function getDetailPageState(
  result: FrigateResult<FrigateEvent>,
): DetailPageState {
  if (!result.ok) {
    if (result.status === 404) {
      return {
        kind: 'error',
        message:
          "The event you're looking for doesn't exist or has been removed.",
      }
    }
    return {
      kind: 'error',
      message: 'Could not load event. Check that Frigate is running.',
    }
  }
  return { kind: 'event', event: result.data }
}

export function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDuration(startTime: number, endTime: number): string {
  const diff = Math.round(endTime - startTime)
  if (diff < 60) return `${diff}s`
  const mins = Math.floor(diff / 60)
  const secs = diff % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export function getDownloadUrl(
  eventId: string,
  kind: 'clip' | 'snapshot',
): string {
  const extension = kind === 'clip' ? 'clip' : 'snapshot'
  return `/api/events/${eventId}/${extension}?download=true`
}

// ─── Components ───

export function CameraEventDetailPage({
  result,
  initialFavorited = false,
}: {
  result: FrigateResult<FrigateEvent>
  initialFavorited?: boolean
}) {
  const state = getDetailPageState(result)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  // Latches to true on first accordion open. We don't mount the
  // EventClipPlayer until this is true, so preload='metadata' doesn't
  // fire against the proxy on every page visit. Once opened, the player
  // stays mounted so re-expanding the accordion is instant.
  const [clipAccordionOpened, setClipAccordionOpened] = useState(false)
  // Call hook unconditionally (React rules) — use empty string as sentinel in error branch
  const eventId = state.kind === 'event' ? state.event.id : ''
  const {
    favorited,
    pending,
    error: favoriteError,
    toggle,
  } = useFavoriteToggle(eventId, initialFavorited)

  if (state.kind === 'error') {
    return (
      <main id="main-content" className="page-wrap px-4 py-6 sm:py-12">
        <section className="island-shell rise-in rounded-4xl px-5 py-6 text-center sm:px-8 sm:py-8">
          <p className="island-kicker mb-1">Camera Events</p>
          <h1 className="display-title mb-3 text-2xl font-bold text-(--sea-ink) sm:text-4xl">
            Event not found
          </h1>
          <p className="mx-auto mb-6 max-w-md text-base text-(--sea-ink-soft) sm:text-lg">
            {state.message}
          </p>
          <Link
            to="/camera-events"
            className="inline-flex min-h-11 items-center rounded-full border border-(--accent-strong-border) bg-(--accent-strong-bg) px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-(--accent-strong-hover-bg)"
          >
            Back to Camera Events
          </Link>
        </section>
      </main>
    )
  }

  const { event } = state
  const dotColor = getLabelDotColor(event.label)

  const snapshotSrc = `/api/events/${event.id}/snapshot`
  const snapshotAlt = `Snapshot of ${formatLabelName(event.label)} detected by ${formatCameraName(event.camera)}`

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <div className="mb-6">
        <Link
          to="/camera-events"
          className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-(--lagoon-deep) no-underline transition hover:text-(--sea-ink)"
        >
          &larr; Back to Camera Events
        </Link>
      </div>

      <section className="rise-in relative overflow-hidden island-shell-sm sm:rounded-4xl sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 hidden h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)] sm:block" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 hidden h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)] sm:block" />

        <p className="island-kicker mb-1">{formatCameraName(event.camera)}</p>

        <h1 className="display-title mb-2 flex max-w-3xl items-center gap-3 text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          <span
            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden="true"
          />
          {formatLabelName(event.label)}
          {event.sub_label && (
            <span className="text-xl font-normal text-(--sea-ink-soft) sm:text-2xl">
              — {event.sub_label}
            </span>
          )}
        </h1>

        <div className="mb-6 flex items-center gap-3">
          <p className="text-sm text-(--sea-ink-soft)">
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
            className="-mx-4 mb-6 overflow-hidden border-y border-(--line) bg-(--surface) sm:mx-0 sm:mb-8 sm:rounded-2xl sm:border"
            onToggle={(e) => {
              if (e.currentTarget.open) {
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
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-7 py-3 text-sm font-semibold text-(--lagoon-deep) transition hover:bg-(--accent-hover-bg) sm:px-4">
              <Film className="h-4 w-4" aria-hidden="true" />
              Watch clip
            </summary>
            {clipAccordionOpened && (
              <div className="border-t border-(--line)">
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

        <dl className="mt-4 grid grid-cols-1 gap-0 divide-y divide-(--line) sm:mt-6 sm:grid-cols-2 sm:gap-4 sm:divide-y-0 lg:grid-cols-3">
          <InfoCard
            icon={Camera}
            label="Camera"
            value={formatCameraName(event.camera)}
          />
          <InfoCard
            icon={Clock}
            label="Duration"
            value={formatDuration(event.start_time, event.end_time)}
          />
          {event.zones.length > 0 && (
            <InfoCard
              icon={MapPin}
              label="Zones"
              value={event.zones.join(', ')}
            />
          )}
          <InfoCard
            icon={Film}
            label="Clip"
            value={event.has_clip ? 'Available' : 'None'}
            downloadUrl={
              event.has_clip ? getDownloadUrl(event.id, 'clip') : undefined
            }
            aria-label={event.has_clip ? 'Download video clip' : undefined}
          />
          <InfoCard
            icon={Image}
            label="Snapshot"
            value={event.has_snapshot ? 'Available' : 'None'}
            downloadUrl={
              event.has_snapshot
                ? getDownloadUrl(event.id, 'snapshot')
                : undefined
            }
            aria-label={
              event.has_snapshot ? 'Download snapshot image' : undefined
            }
          />
        </dl>

        {event.data.score > 0 && (
          <div className="mt-4 border-t border-(--line) pt-4 sm:mt-6 sm:rounded-xl sm:border sm:bg-(--surface) sm:p-4 sm:pt-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
              Detection confidence
            </h2>
            <div className="flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-(--line)"
                role="progressbar"
                aria-valuenow={Math.round(event.data.top_score * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Detection confidence"
              >
                <div
                  className="h-full rounded-full bg-(--lagoon-deep) transition-all"
                  style={{
                    width: `${Math.round(event.data.top_score * 100)}%`,
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-(--sea-ink)">
                {Math.round(event.data.top_score * 100)}%
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
