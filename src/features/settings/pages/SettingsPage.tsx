import {
  useEventLimit,
  MIN_EVENT_LIMIT,
  MAX_EVENT_LIMIT,
  EVENT_LIMIT_STEP,
} from '#/features/shared/hooks/useEventLimit'
import {
  useLiveViewRefreshInterval,
  MIN_LIVE_VIEW_REFRESH_SECONDS,
  MAX_LIVE_VIEW_REFRESH_SECONDS,
  LIVE_VIEW_REFRESH_STEP,
} from '#/features/shared/hooks/useLiveViewRefreshInterval'
import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'
import { NotificationSettings } from '../components/NotificationSettings'
import { AdminNotificationMute } from '../components/AdminNotificationMute'
import { AppearanceSettings } from '../components/AppearanceSettings'

export function getSettingsContent(): { heading: string; description: string } {
  return {
    heading: 'Settings',
    description: 'Account preferences and camera configuration.',
  }
}

export function SettingsPage() {
  const content = getSettingsContent()
  const [eventLimit, setEventLimit] = useEventLimit()
  const [liveViewRefreshSeconds, setLiveViewRefreshSeconds] =
    useLiveViewRefreshInterval()

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <Card variant="hero" className="rise-in">
        <p className="eyebrow mb-1">Account</p>
        <h1 className="mb-0 max-w-3xl text-3xl font-semibold tracking-tight leading-display text-foreground sm:text-4xl">
          {content.heading}
        </h1>
      </Card>

      <AppearanceSettings className="mt-6" />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Camera Events
          </CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="event-limit-slider"
            className="text-sm font-medium text-foreground"
          >
            Number of events to display
          </label>
          <div className="flex items-center gap-4">
            <input
              id="event-limit-slider"
              type="range"
              min={MIN_EVENT_LIMIT}
              max={MAX_EVENT_LIMIT}
              step={EVENT_LIMIT_STEP}
              value={eventLimit}
              onChange={(e) => setEventLimit(Number(e.target.value))}
              aria-label="Number of events to display"
              aria-describedby="event-limit-desc"
              aria-valuemin={MIN_EVENT_LIMIT}
              aria-valuemax={MAX_EVENT_LIMIT}
              aria-valuenow={eventLimit}
              className="min-h-11 w-full flex-1 cursor-pointer accent-brand-strong"
            />
            <span
              className="min-w-16 rounded-input border border-border bg-surface-warm px-3 py-1.5 text-center text-sm font-medium text-foreground tabular-nums"
              aria-live="polite"
            >
              {eventLimit} events
            </span>
          </div>
          <p id="event-limit-desc" className="text-xs text-muted-foreground">
            Controls how many events are loaded on the Camera Events page.
            Range: {MIN_EVENT_LIMIT}–{MAX_EVENT_LIMIT}.
          </p>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Live View
          </CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="live-view-refresh-slider"
            className="text-sm font-medium text-foreground"
          >
            Refresh interval
          </label>
          <div className="flex items-center gap-4">
            <input
              id="live-view-refresh-slider"
              type="range"
              min={MIN_LIVE_VIEW_REFRESH_SECONDS}
              max={MAX_LIVE_VIEW_REFRESH_SECONDS}
              step={LIVE_VIEW_REFRESH_STEP}
              value={liveViewRefreshSeconds}
              onChange={(e) =>
                setLiveViewRefreshSeconds(Number(e.target.value))
              }
              aria-label="Refresh interval"
              aria-describedby="live-view-refresh-desc"
              aria-valuemin={MIN_LIVE_VIEW_REFRESH_SECONDS}
              aria-valuemax={MAX_LIVE_VIEW_REFRESH_SECONDS}
              aria-valuenow={liveViewRefreshSeconds}
              className="min-h-11 w-full flex-1 cursor-pointer accent-brand-strong"
            />
            <span
              className="min-w-16 rounded-input border border-border bg-surface-warm px-3 py-1.5 text-center text-sm font-medium text-foreground tabular-nums"
              aria-live="polite"
            >
              {liveViewRefreshSeconds}s
            </span>
          </div>
          <p
            id="live-view-refresh-desc"
            className="text-xs text-muted-foreground"
          >
            How often the live camera snapshot refreshes. Range:{' '}
            {MIN_LIVE_VIEW_REFRESH_SECONDS}–{MAX_LIVE_VIEW_REFRESH_SECONDS}{' '}
            seconds.
          </p>
        </div>
      </Card>
      <NotificationSettings />
      <AdminNotificationMute />
    </main>
  )
}
