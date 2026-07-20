import { useState } from 'react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { LiveMsePlayer } from '#/features/live/components/LiveMsePlayer'

export type LiveState =
  | { kind: 'cameras'; cameras: string[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

export function getLivePageState(result: FrigateResult<string[]>): LiveState {
  if (!result.ok) {
    return {
      kind: 'error',
      message: 'Could not load cameras. Check that Frigate is running.',
    }
  }
  if (result.data.length === 0) {
    return { kind: 'empty' }
  }
  return { kind: 'cameras', cameras: result.data }
}

export function LivePage({ result }: { result: FrigateResult<string[]> }) {
  const state = getLivePageState(result)
  const cameras = state.kind === 'cameras' ? state.cameras : []
  const [selected, setSelected] = useState(cameras[0])
  const activeCamera = cameras.includes(selected) ? selected : cameras[0]

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-a),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,var(--hero-b),transparent_66%)]" />
        <p className="island-kicker mb-1">Live</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Live view
        </h1>
      </section>

      {state.kind === 'empty' && (
        <p className="mt-8 text-center text-(--sea-ink-soft)">
          No cameras found
        </p>
      )}

      {state.kind === 'error' && (
        <div
          role="alert"
          className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
        >
          {state.message}
        </div>
      )}

      {state.kind === 'cameras' && (
        <>
          <div
            role="group"
            aria-label="Choose a camera"
            className="mt-6 flex gap-2 overflow-x-auto pb-1"
          >
            {cameras.map((camera) => {
              const isActive = camera === activeCamera
              return (
                <button
                  key={camera}
                  type="button"
                  aria-pressed={isActive}
                  aria-label={`Show live view for ${camera}`}
                  onClick={() => setSelected(camera)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                    isActive
                      ? 'border-(--accent-emphasis-border) bg-(--accent-emphasis-bg) text-(--lagoon-deep)'
                      : 'border-(--chip-line) bg-(--chip-bg) text-(--sea-ink-soft) hover:text-(--sea-ink)'
                  }`}
                >
                  {camera}
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <LiveMsePlayer camera={activeCamera} />
          </div>
        </>
      )}
    </main>
  )
}
