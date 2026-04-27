import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { reorderOnDragEnd, SortableCamerasGrid } from './SortableCamerasGrid'

// Tests cover reorderOnDragEnd (AC-1, AC-4) — the pure drag-end handler.
// The grid's rendering and sensor wiring are validated by the CamerasPage
// integration tests in Step 8 and the Playwright e2e in Step 10.

type DragEndEvent = Parameters<typeof reorderOnDragEnd>[1]

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: ReactNode }) => children,
  PointerSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  useSensor: () => ({}),
  useSensors: (...args: unknown[]) => args,
  closestCenter: () => null,
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => children,
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: () => ({}),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  arrayMove: <T,>(arr: T[], from: number, to: number) => {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  },
}))
vi.mock('@dnd-kit/modifiers', () => ({
  restrictToParentElement: () => ({ x: 0, y: 0 }),
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

describe('reorderOnDragEnd', () => {
  it('moves an item backward (drag to earlier position)', () => {
    const cameras = ['front', 'back', 'garage']
    const onOrderChange = vi.fn()
    reorderOnDragEnd(
      cameras,
      { active: { id: 'garage' }, over: { id: 'front' } } as DragEndEvent,
      onOrderChange,
    )
    expect(onOrderChange).toHaveBeenCalledWith(['garage', 'front', 'back'])
  })

  it('moves an item forward (drag to later position)', () => {
    const cameras = ['front', 'back', 'garage']
    const onOrderChange = vi.fn()
    reorderOnDragEnd(
      cameras,
      { active: { id: 'front' }, over: { id: 'garage' } } as DragEndEvent,
      onOrderChange,
    )
    expect(onOrderChange).toHaveBeenCalledWith(['back', 'garage', 'front'])
  })

  it('does not call onOrderChange when active and over are the same', () => {
    const cameras = ['front', 'back', 'garage']
    const onOrderChange = vi.fn()
    reorderOnDragEnd(
      cameras,
      { active: { id: 'front' }, over: { id: 'front' } } as DragEndEvent,
      onOrderChange,
    )
    expect(onOrderChange).not.toHaveBeenCalled()
  })

  it('does not call onOrderChange when over is null (cancelled drag)', () => {
    const cameras = ['front', 'back', 'garage']
    const onOrderChange = vi.fn()
    reorderOnDragEnd(
      cameras,
      { active: { id: 'front' }, over: null } as unknown as DragEndEvent,
      onOrderChange,
    )
    expect(onOrderChange).not.toHaveBeenCalled()
  })
})

// Verify the grid component renders SortableCameraTile elements
// with the correct keys and props (structural check via JSX).
describe('SortableCamerasGrid structure', () => {
  it('renders one child per camera', () => {
    const cameras = ['front', 'back', 'garage']
    const output = SortableCamerasGrid({
      cameras,
      isEditing: false,
      onOrderChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    // Each camera name appears in the children
    expect(json).toContain('front')
    expect(json).toContain('back')
    expect(json).toContain('garage')
  })

  it('passes isEditing to tile props', () => {
    const cameras = ['front']
    const editJSON = JSON.stringify(
      SortableCamerasGrid({
        cameras,
        isEditing: true,
        onOrderChange: vi.fn(),
      }),
    )
    const viewJSON = JSON.stringify(
      SortableCamerasGrid({
        cameras,
        isEditing: false,
        onOrderChange: vi.fn(),
      }),
    )
    // isEditing=true → prop is present in serialized children
    expect(editJSON).toContain('"isEditing":true')
    expect(viewJSON).toContain('"isEditing":false')
  })
})
