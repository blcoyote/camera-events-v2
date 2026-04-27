import { useState } from 'react'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import {
  useCameraOrder,
  SAVE_ERROR_MESSAGE,
} from '#/features/cameras/hooks/useCameraOrder'
import { SortableCamerasGrid } from '#/features/cameras/components/SortableCamerasGrid'

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

export function getCameraCardData(
  name: string,
  refreshKey?: number,
): {
  name: string
  imgSrc: string
  altText: string
} {
  const base = `/api/cameras/${name}/latest`
  return {
    name,
    imgSrc: refreshKey ? `${base}?t=${refreshKey}` : base,
    altText: `Latest snapshot from ${name}`,
  }
}

export function CamerasLoading() {
  return (
    <main
      id="main-content"
      aria-busy="true"
      className="page-wrap px-4 pb-8 pt-6 sm:pt-14"
    >
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <p className="island-kicker mb-1">Cameras</p>
        <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
          Loading cameras…
        </h1>
      </section>
      <p className="sr-only" role="status">
        Loading cameras
      </p>
    </main>
  )
}

export function CamerasPage({
  result,
  refreshKey,
  isEditing,
  onEditingChange,
}: {
  result: FrigateResult<string[]>
  refreshKey?: number
  isEditing: boolean
  onEditingChange: (editing: boolean) => void
}) {
  const state = getCamerasPageState(result)
  const frigateCameras = state.kind === 'cameras' ? state.cameras : []
  const { visibleOrder, setOrder, saveError, dismissError } =
    useCameraOrder(frigateCameras)

  const hasCameras = state.kind === 'cameras'

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-4xl px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="island-kicker mb-1">Cameras</p>
            <h1 className="display-title mb-0 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-(--sea-ink) sm:text-4xl">
              Latest snapshots
            </h1>
          </div>
          {hasCameras && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                title="Reorder cameras on this device"
                onClick={() => onEditingChange(!isEditing)}
                className="rounded-lg border border-(--sea-ink-soft)/30 px-3 py-1.5 text-sm font-medium text-(--sea-ink) transition-colors hover:bg-(--surface-raised)"
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
              <span className="text-xs text-(--sea-ink-soft)">
                Order saved on this device
              </span>
            </div>
          )}
        </div>
      </section>

      {saveError && (
        <div
          role="alert"
          className="mx-auto mt-4 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <div className="flex items-center justify-between gap-4">
            <span>{saveError}</span>
            <button
              type="button"
              onClick={dismissError}
              className="shrink-0 font-medium underline"
              aria-label="Dismiss storage error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

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
        <SortableCamerasGrid
          cameras={visibleOrder}
          isEditing={isEditing}
          onOrderChange={setOrder}
        />
      )}
    </main>
  )
}
