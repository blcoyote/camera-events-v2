import type { DragEndEvent } from '@dnd-kit/core'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableCameraTile } from './SortableCameraTile'

export function reorderOnDragEnd(
  cameras: string[],
  event: DragEndEvent,
  onOrderChange: (next: string[]) => void,
): void {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIndex = cameras.indexOf(active.id as string)
  const newIndex = cameras.indexOf(over.id as string)
  onOrderChange(arrayMove(cameras, oldIndex, newIndex))
}

interface SortableCamerasGridProps {
  cameras: string[]
  isEditing: boolean
  onOrderChange: (next: string[]) => void
}

export function SortableCamerasGrid({
  cameras,
  isEditing,
  onOrderChange,
}: SortableCamerasGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    reorderOnDragEnd(cameras, event, onOrderChange)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cameras} strategy={verticalListSortingStrategy}>
        <section
          aria-label="Camera list"
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cameras.map((name, index) => (
            <SortableCameraTile
              key={name}
              name={name}
              isEditing={isEditing}
              imgSrc={`/api/cameras/${name}/latest`}
              index={index}
            />
          ))}
        </section>
      </SortableContext>
    </DndContext>
  )
}
