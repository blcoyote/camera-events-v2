import { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Camera, Clock, Tag, MapPin, Film, Image, Download } from 'lucide-react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import { formatRelativeTime, formatLabelName, getLabelDotColor } from '../utils'

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

export function formatCameraName(camera: string): string {
  return camera
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
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
  if (kind === 'clip') {
    return `/api/events/${eventId}/clip`
  }
  return `/api/events/${eventId}/snapshot?download=true`
}

// ─── Components ───

function EventSnapshot({
  eventId,
  camera,
  label,
}: {
  eventId: string
  camera: string
  label: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--line) bg-(--surface)">
      <img
        src={`/api/events/${eventId}/snapshot`}
        alt={`Snapshot of ${formatLabelName(label)} detected by ${formatCameraName(camera)}`}
        className="h-auto w-full object-contain"
        loading="eager"
      />
    </div>
  )
}

function useBlobDownload() {
  const [downloading, setDownloading] = useState(false)

  const download = useCallback(async (url: string) => {
    setDownloading(true)
    try {
      const res = await fetch(url, { credentials: 'include' })
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] ?? url.split('/').pop() ?? 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } finally {
      setDownloading(false)
    }
  }, [])

  return { download, downloading }
}

function InfoCard({
  icon: Icon,
  label,
  value,
  downloadUrl,
  'aria-label': ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  downloadUrl?: string
  'aria-label'?: string
}) {
  const { download, downloading } = useBlobDownload()

  const inner = (
    <>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-(--sea-ink) sm:mt-1 sm:text-base">
        {value}
        {downloadUrl && (
          <Download
            className="h-3 w-3 text-(--lagoon-deep) sm:h-3.5 sm:w-3.5"
            aria-hidden="true"
          />
        )}
      </dd>
    </>
  )

  if (downloadUrl) {
    return (
      <div className="rounded-xl border border-(--line) bg-(--surface) transition hover:border-(--lagoon-deep) hover:bg-[rgba(79,184,178,0.06)]">
        <button
          type="button"
          onClick={() => download(downloadUrl)}
          disabled={downloading}
          aria-label={ariaLabel}
          className="block w-full cursor-pointer px-3 py-2.5 text-left sm:p-4"
        >
          {inner}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-(--line) bg-(--surface) px-3 py-2.5 sm:p-4">
      {inner}
    </div>
  )
}

export function CameraEventDetailPage({
  result,
}: {
  result: FrigateResult<FrigateEvent>
}) {
  const state = getDetailPageState(result)

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
            className="inline-flex min-h-11 items-center rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-(--lagoon-deep) no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
          >
            Back to Camera Events
          </Link>
        </section>
      </main>
    )
  }

  const { event } = state
  const dotColor = getLabelDotColor(event.label)

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

      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />

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

        <p className="mb-6 text-sm text-(--sea-ink-soft)">
          {formatRelativeTime(event.start_time)} ·{' '}
          {formatTimestamp(event.start_time)}
        </p>

        {event.has_snapshot && (
          <div className="mb-8">
            <EventSnapshot
              eventId={event.id}
              camera={event.camera}
              label={event.label}
            />
          </div>
        )}

        <dl className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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
          <div className="mt-2.5 rounded-xl border border-(--line) bg-(--surface) px-3 py-2.5 sm:mt-6 sm:p-4">
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
    </main>
  )
}
