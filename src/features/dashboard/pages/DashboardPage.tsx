import { Activity, Bell, Camera, Gauge } from 'lucide-react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { DashboardData } from '#/features/dashboard/types'
import { getDashboardPageState } from '#/features/dashboard/utils/getDashboardPageState'
import {
  aggregateByCamera,
  aggregateByLabel,
  aggregateByDay,
  totalEventCount,
} from '#/features/dashboard/utils/aggregate'
import { summarizeSystemHealth } from '#/features/dashboard/utils/systemHealth'
import { formatDayLabel } from '#/features/dashboard/utils/format'
import { StatTile } from '#/features/dashboard/components/StatTile'
import { BarList } from '#/features/dashboard/components/BarList'
import type { BarListItem } from '#/features/dashboard/components/BarList'
import { SystemHealthCard } from '#/features/dashboard/components/SystemHealthCard'
import {
  formatCameraName,
  formatLabelName,
  getLabelDotColor,
} from '#/features/shared/utils/eventFormatting'

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-(--line) bg-(--surface) px-5 py-5">
      <h2 className="mb-4 text-base font-bold text-(--sea-ink)">{title}</h2>
      {children}
    </section>
  )
}

export function DashboardPage({
  result,
}: {
  result: FrigateResult<DashboardData>
}) {
  const state = getDashboardPageState(result)

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)]" />
        <p className="island-kicker mb-1">Dashboard</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Activity overview
        </h1>
      </section>

      {state.kind === 'error' && (
        <div
          role="alert"
          className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
        >
          {state.message}
        </div>
      )}

      {state.kind === 'empty' && (
        <p className="mt-8 text-center text-(--sea-ink-soft)">
          No activity data available yet.
        </p>
      )}

      {state.kind === 'ready' && <DashboardContent data={state.data} />}
    </main>
  )
}

function DashboardContent({ data }: { data: DashboardData }) {
  const { summary, stats, review } = data
  const health = stats ? summarizeSystemHealth(stats) : null

  const cameraItems: BarListItem[] = aggregateByCamera(summary).map((e) => ({
    key: e.key,
    label: formatCameraName(e.key),
    count: e.count,
  }))
  const labelItems: BarListItem[] = aggregateByLabel(summary).map((e) => ({
    key: e.key,
    label: formatLabelName(e.key),
    count: e.count,
    color: getLabelDotColor(e.key),
  }))
  const dayItems: BarListItem[] = aggregateByDay(summary).map((e) => ({
    key: e.key,
    label: formatDayLabel(e.key),
    count: e.count,
  }))

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Events"
          value={totalEventCount(summary)}
          hint="recent total"
          icon={<Activity size={16} aria-hidden />}
        />
        <StatTile
          label="Alerts 24h"
          value={review ? review.last24Hours.total_alert : '—'}
          hint="last 24 hours"
          icon={<Bell size={16} aria-hidden />}
        />
        <StatTile
          label="Detections 24h"
          value={review ? review.last24Hours.total_detection : '—'}
          hint="last 24 hours"
          icon={<Gauge size={16} aria-hidden />}
        />
        <StatTile
          label="Cameras"
          value={health ? health.activeCameraCount : '—'}
          hint="reporting"
          icon={<Camera size={16} aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Events by camera">
          <BarList items={cameraItems} emptyMessage="No events recorded" />
        </Panel>
        <Panel title="Events by type">
          <BarList items={labelItems} emptyMessage="No events recorded" />
        </Panel>
      </div>

      <Panel title="Events by day">
        <BarList items={dayItems} emptyMessage="No events recorded" />
      </Panel>

      {health && <SystemHealthCard health={health} />}
    </div>
  )
}
