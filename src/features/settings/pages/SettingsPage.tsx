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
import { Label } from '#/features/shared/components/ui/label'
import { Slider } from '#/features/shared/components/ui/slider'
import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'
import { NotificationSettings } from '../components/NotificationSettings'
import { AdminNotificationMute } from '../components/AdminNotificationMute'
import { AppearanceSettings } from '../components/AppearanceSettings'
import { PageHeader } from '#/features/shared/components/PageHeader'

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
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader eyebrow="Account" title={content.heading} />

      <AppearanceSettings className="mt-6" />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Camera Events</CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3">
          <Label id="event-limit-label">Number of events to display</Label>
          <div className="flex items-center gap-4">
            <Slider
              min={MIN_EVENT_LIMIT}
              max={MAX_EVENT_LIMIT}
              step={EVENT_LIMIT_STEP}
              value={[eventLimit]}
              onValueChange={([n]) => setEventLimit(n)}
              aria-labelledby="event-limit-label"
              aria-describedby="event-limit-desc"
              className="flex-1"
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
          <CardTitle>Live View</CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3">
          <Label id="live-view-refresh-label">Refresh interval</Label>
          <div className="flex items-center gap-4">
            <Slider
              min={MIN_LIVE_VIEW_REFRESH_SECONDS}
              max={MAX_LIVE_VIEW_REFRESH_SECONDS}
              step={LIVE_VIEW_REFRESH_STEP}
              value={[liveViewRefreshSeconds]}
              onValueChange={([n]) => setLiveViewRefreshSeconds(n)}
              aria-labelledby="live-view-refresh-label"
              aria-describedby="live-view-refresh-desc"
              className="flex-1"
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
