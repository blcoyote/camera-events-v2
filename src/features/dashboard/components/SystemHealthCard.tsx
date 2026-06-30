import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { SystemHealth } from '#/features/dashboard/utils/systemHealth'
import {
  formatUptime,
  formatStorageMb,
  formatPct,
} from '#/features/dashboard/utils/format'
import { formatCameraName } from '#/features/shared/utils/eventFormatting'

export function SystemHealthCard({ health }: { health: SystemHealth }) {
  return (
    <section className="rounded-2xl border border-(--line) bg-(--surface) px-5 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-(--sea-ink)">System health</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-(--sea-ink-soft)">
          {health.updateAvailable ? (
            <>
              <AlertCircle size={14} className="text-amber-500" aria-hidden />
              Frigate {health.version} — {health.latestVersion} available
            </>
          ) : (
            <>
              <CheckCircle2 size={14} className="text-(--palm)" aria-hidden />
              Frigate {health.version || 'unknown'}
            </>
          )}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-(--sea-ink-soft)">Detection FPS</dt>
          <dd className="text-lg font-semibold tabular-nums text-(--sea-ink)">
            {health.detectionFps.toFixed(1)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-(--sea-ink-soft)">Cameras</dt>
          <dd className="text-lg font-semibold tabular-nums text-(--sea-ink)">
            {health.activeCameraCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-(--sea-ink-soft)">Uptime</dt>
          <dd className="text-lg font-semibold text-(--sea-ink)">
            {formatUptime(health.uptime)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-(--sea-ink-soft)">Inference</dt>
          <dd className="text-lg font-semibold tabular-nums text-(--sea-ink)">
            {health.detectors.length > 0
              ? `${health.detectors[0].inferenceSpeed.toFixed(1)} ms`
              : '—'}
          </dd>
        </div>
      </dl>

      {health.storage.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {health.storage.map((s) => (
            <div key={s.name}>
              <div className="mb-1 flex items-center justify-between text-xs text-(--sea-ink-soft)">
                <span className="truncate">{s.name}</span>
                <span className="tabular-nums">
                  {formatStorageMb(s.usedMb)} / {formatStorageMb(s.totalMb)} (
                  {formatPct(s.usedPct)})
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-(--surface-strong)">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-(--lagoon)"
                  style={{ width: `${Math.min(100, s.usedPct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {health.cameras.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-(--sea-ink-soft)">
                <th className="pb-1 font-medium">Camera</th>
                <th className="pb-1 text-right font-medium">Cam FPS</th>
                <th className="pb-1 text-right font-medium">Det FPS</th>
                <th className="pb-1 text-right font-medium">Detect</th>
              </tr>
            </thead>
            <tbody className="text-(--sea-ink)">
              {health.cameras.map((c) => (
                <tr key={c.name} className="border-t border-(--line)">
                  <td className="py-1.5 font-medium">
                    {formatCameraName(c.name)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {c.cameraFps.toFixed(1)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {c.detectionFps.toFixed(1)}
                  </td>
                  <td className="py-1.5 text-right">
                    {c.detectionEnabled ? (
                      <span className="text-(--palm)">on</span>
                    ) : (
                      <span className="text-(--sea-ink-soft)">off</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
