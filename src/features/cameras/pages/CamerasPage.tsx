import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { useCameraOrder } from '#/features/cameras/hooks/useCameraOrder'
import { SortableCamerasGrid } from '#/features/cameras/components/SortableCamerasGrid'
import { Check, Pencil } from 'lucide-react'
import { Button } from '#/features/shared/components/ui/button'
import { Toggle } from '#/features/shared/components/ui/toggle'

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

export function CamerasPage({
  result,
  isEditing,
  onEditingChange,
  imgRefreshKey = 0,
}: {
  result: FrigateResult<string[]>
  isEditing: boolean
  onEditingChange: (editing: boolean) => void
  imgRefreshKey?: number
}) {
  const state = getCamerasPageState(result)
  const frigateCameras = state.kind === 'cameras' ? state.cameras : []
  const { visibleOrder, setOrder, saveError, dismissError } =
    useCameraOrder(frigateCameras)

  const hasCameras = state.kind === 'cameras'

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="glass rise-in relative overflow-hidden rounded-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Cameras</p>
            <h1 className="mb-0 max-w-3xl text-3xl leading-display font-semibold tracking-tight sm:text-4xl">
              Latest snapshots
            </h1>
          </div>
          {hasCameras && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Toggle
                aria-label={
                  isEditing ? 'Done reordering cameras' : 'Reorder cameras'
                }
                pressed={isEditing}
                onPressedChange={onEditingChange}
                title="Reorder cameras on this device"
                className="size-11 px-0"
              >
                {isEditing ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Pencil size={16} aria-hidden="true" />
                )}
              </Toggle>
            </div>
          )}
        </div>
      </section>

      {saveError && (
        <div
          role="alert"
          className="mx-auto mt-4 max-w-3xl rounded-card border border-warn/40 bg-surface-hover px-4 py-3 text-sm text-warn-text"
        >
          <div className="flex items-center justify-between gap-4">
            <span>{saveError}</span>
            <Button
              variant="link"
              size="sm"
              onClick={dismissError}
              className="shrink-0"
              aria-label="Dismiss storage error"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {state.kind === 'empty' && (
        <p className="mt-8 text-center text-fg-2">No cameras found</p>
      )}

      {state.kind === 'error' && (
        <div
          role="alert"
          className="mx-auto mt-8 max-w-3xl rounded-card border border-danger/40 bg-surface-hover px-4 py-3 text-sm text-danger-text"
        >
          {state.message}
        </div>
      )}

      {state.kind === 'cameras' && (
        <SortableCamerasGrid
          cameras={visibleOrder}
          isEditing={isEditing}
          onOrderChange={setOrder}
          refreshKey={imgRefreshKey}
        />
      )}
    </main>
  )
}
