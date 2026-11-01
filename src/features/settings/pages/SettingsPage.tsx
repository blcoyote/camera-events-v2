import { m } from '#/paraglide/messages.js'
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
    heading: m.shell_tab_settings(),
    description: m.settings_description(),
  }
}

export function SettingsPage() {
  const content = getSettingsContent()
  const [eventLimit, setEventLimit] = useEventLimit()
  const [liveViewRefreshSeconds, setLiveViewRefreshSeconds] =
    useLiveViewRefreshInterval()

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader eyebrow={m.settings_account()} title={content.heading} />

      <AppearanceSettings className="mt-6" />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{m.settings_camera_events()}</CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3">
          <Label id="event-limit-label">{m.settings_event_limit_label()}</Label>
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
              {m.settings_event_count({ count: eventLimit })}
            </span>
          </div>
          <p id="event-limit-desc" className="text-xs text-muted-foreground">
            {m.settings_event_limit_desc({
              min: MIN_EVENT_LIMIT,
              max: MAX_EVENT_LIMIT,
            })}
          </p>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{m.settings_live_view()}</CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-3">
          <Label id="live-view-refresh-label">
            {m.settings_refresh_interval()}
          </Label>
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
              {m.settings_refresh_seconds({ seconds: liveViewRefreshSeconds })}
            </span>
          </div>
          <p
            id="live-view-refresh-desc"
            className="text-xs text-muted-foreground"
          >
            {m.settings_refresh_desc({
              min: MIN_LIVE_VIEW_REFRESH_SECONDS,
              max: MAX_LIVE_VIEW_REFRESH_SECONDS,
            })}
          </p>
        </div>
      </Card>
      <NotificationSettings />
      <AdminNotificationMute />
    </main>
  )
}
