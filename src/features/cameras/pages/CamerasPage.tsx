import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { useCameraOrder } from '#/features/cameras/hooks/useCameraOrder'
import { SortableCamerasGrid } from '#/features/cameras/components/SortableCamerasGrid'
import { ArrowUpDown, Check, GripVertical } from 'lucide-react'
import { Button } from '#/features/shared/components/ui/button'
import { PageHeader } from '#/features/shared/components/PageHeader'

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

  const canArrange = state.kind === 'cameras' && state.cameras.length > 1

  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader
        eyebrow="Cameras"
        title="Latest snapshots"
        actions={
          canArrange && (
            <Button
              variant={isEditing ? 'default' : 'secondary'}
              size="sm"
              onClick={() => onEditingChange(!isEditing)}
              className="shrink-0"
            >
              {isEditing ? (
                <>
                  <Check size={16} aria-hidden="true" /> Done
                </>
              ) : (
                <>
                  <ArrowUpDown size={16} aria-hidden="true" /> Arrange
                </>
              )}
            </Button>
          )
        }
      />

      {canArrange && (
        <p role="status" className="mt-4 text-sm text-fg-2 empty:hidden">
          {isEditing && (
            <>
              Drag{' '}
              <GripVertical
                size={16}
                aria-hidden="true"
                className="inline-block align-text-bottom"
              />{' '}
              to move a camera. The order is saved on this device only.
            </>
          )}
        </p>
      )}

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
