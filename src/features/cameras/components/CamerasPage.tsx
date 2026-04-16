import { useState } from 'react'
import { MediaCard } from '#/features/shared/components/MediaCard'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

type CamerasState =
  | { kind: 'cameras'; cameras: string[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }

export function getCamerasPageState(
  result: FrigateResult<string[]>,
): CamerasState {
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

export function getCameraCardData(name: string): {
  name: string
  imgSrc: string
  altText: string
} {
  return {
    name,
    imgSrc: `/api/cameras/${name}/latest`,
    altText: `Latest snapshot from ${name}`,
  }
}

export function CamerasLoading() {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Cameras</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Loading cameras…
        </h1>
      </section>
    </main>
  )
}

function SnapshotImage({
  imgSrc,
  altText,
}: {
  imgSrc: string
  altText: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-(--surface) text-sm text-(--sea-ink-soft)">
        Snapshot unavailable
      </div>
    )
  }

  return (
    <img
      src={imgSrc}
      alt={altText}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  )
}

export function CamerasPage({ result }: { result: FrigateResult<string[]> }) {
  const state = getCamerasPageState(result)

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Cameras</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Cameras
        </h1>
        <p className="mb-8 max-w-2xl text-base text-(--sea-ink-soft) sm:text-lg">
          Live snapshots from your connected cameras.
        </p>
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
        <section
          aria-label="Camera list"
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {state.cameras.map((name, index) => {
            const card = getCameraCardData(name)
            return (
              <MediaCard
                key={name}
                index={index}
                scanLines={false}
                image={
                  <SnapshotImage imgSrc={card.imgSrc} altText={card.altText} />
                }
              >
                <h2 className="text-sm font-semibold text-(--sea-ink)">
                  {card.name}
                </h2>
              </MediaCard>
            )
          })}
        </section>
      )}
    </main>
  )
}
