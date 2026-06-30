// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DashboardPage } from './DashboardPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import type { DashboardData } from '#/features/dashboard/types'
import type { FrigateStats } from '#/features/shared/server/frigate/types'

afterEach(cleanup)

const REVIEW = {
  last24Hours: {
    reviewed_alert: 1,
    reviewed_detection: 2,
    total_alert: 4,
    total_detection: 9,
  },
}

const STATS = {
  cameras: {
    front_porch: {
      audio_dBFS: -30,
      audio_rms: -40,
      camera_fps: 5,
      capture_pid: 1,
      detection_enabled: 1,
      detection_fps: 4.5,
      ffmpeg_pid: 2,
      pid: 3,
      process_fps: 5,
      skipped_fps: 0,
    },
  },
  cpu_usages: {},
  detection_fps: 4.5,
  detectors: { cpu: { detection_start: 0, inference_speed: 12, pid: 9 } },
  gpu_usages: {},
  processes: {},
  service: {
    last_updated: 0,
    latest_version: '0.14.0',
    storage: {},
    temperatures: {},
    uptime: 90000,
    version: '0.14.0',
  },
} as FrigateStats

function ready(): FrigateResult<DashboardData> {
  return {
    ok: true,
    data: {
      stats: STATS,
      summary: [
        {
          camera: 'front_porch',
          count: 6,
          day: '2026-06-30',
          label: 'person',
          sub_label: null,
          zones: [],
        },
        {
          camera: 'back_yard',
          count: 2,
          day: '2026-06-30',
          label: 'car',
          sub_label: null,
          zones: [],
        },
      ],
      review: REVIEW,
    },
  }
}

describe('DashboardPage', () => {
  it('renders the error alert when the load failed', () => {
    render(<DashboardPage result={{ ok: false, error: 'boom' }} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Could not load/i)
  })

  it('renders the empty message when there is no data', () => {
    render(
      <DashboardPage
        result={{ ok: true, data: { stats: null, summary: [], review: null } }}
      />,
    )
    expect(screen.getByText(/No activity data available/i)).toBeTruthy()
  })

  it('renders summary tiles and breakdown panels when ready', () => {
    render(<DashboardPage result={ready()} />)
    // Total events (6 + 2 = 8) — appears in the Events tile and the day bar
    expect(screen.getAllByText('8').length).toBeGreaterThan(0)
    // Alerts 24h tile
    expect(screen.getByText('4')).toBeTruthy()
    // Panel headings
    expect(screen.getByText('Events by camera')).toBeTruthy()
    expect(screen.getByText('Events by type')).toBeTruthy()
    expect(screen.getByText('Events by day')).toBeTruthy()
    // Breakdown labels (formatted camera + label names). "Front Porch" also
    // appears in the system-health table, so allow multiple matches.
    expect(screen.getAllByText('Front Porch').length).toBeGreaterThan(0)
    expect(screen.getByText('Person')).toBeTruthy()
  })

  it('renders the system health card when stats are present', () => {
    render(<DashboardPage result={ready()} />)
    expect(screen.getByText('System health')).toBeTruthy()
  })

  it('shows em dashes for review/stats tiles when those payloads are absent', () => {
    render(
      <DashboardPage
        result={{
          ok: true,
          data: {
            stats: null,
            summary: [
              {
                camera: 'a',
                count: 1,
                day: '2026-06-30',
                label: 'person',
                sub_label: null,
                zones: [],
              },
            ],
            review: null,
          },
        }}
      />,
    )
    expect(screen.queryByText('System health')).toBeNull()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})
