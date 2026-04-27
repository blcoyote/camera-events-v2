import { describe, expect, it, vi, beforeEach } from 'vitest'
import React from 'react'
import { SortableCameraTile } from './SortableCameraTile'

// Stub useSortable so the component can be called outside DndContext
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { 'aria-disabled': false },
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: () => ({ x: 0, y: 0 }),
  arrayMove: <T,>(arr: T[], from: number, to: number) => {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  },
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

vi.mock('#/features/shared/components/MediaCard', () => ({
  MediaCard: ({
    children,
    image,
  }: {
    children: React.ReactNode
    image: React.ReactNode
  }) => (
    <div data-testid="media-card">
      <div>{image}</div>
      <div>{children}</div>
    </div>
  ),
}))

function getOutput(props: React.ComponentProps<typeof SortableCameraTile>) {
  return SortableCameraTile(props)
}

describe('SortableCameraTile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the camera name', () => {
    const output = getOutput({
      name: 'front',
      isEditing: false,
      imgSrc: '/img',
    })
    const json = JSON.stringify(output)
    expect(json).toContain('front')
  })

  it('renders a drag handle with accessible aria-label when isEditing is true', () => {
    const output = getOutput({ name: 'front', isEditing: true, imgSrc: '/img' })
    const json = JSON.stringify(output)
    expect(json).toContain('Reorder front')
  })

  it('does not render a drag handle when isEditing is false', () => {
    const output = getOutput({
      name: 'front',
      isEditing: false,
      imgSrc: '/img',
    })
    const json = JSON.stringify(output)
    expect(json).not.toContain('Reorder front')
  })

  it('applies select-none and touch-none classes in edit mode', () => {
    const output = getOutput({ name: 'front', isEditing: true, imgSrc: '/img' })
    const json = JSON.stringify(output)
    expect(json).toContain('select-none')
    expect(json).toContain('touch-none')
  })

  it('does not apply touch-blocking classes outside edit mode', () => {
    const output = getOutput({
      name: 'front',
      isEditing: false,
      imgSrc: '/img',
    })
    const props = (output as React.ReactElement<{ className?: string }>).props
    expect(props.className ?? '').not.toContain('select-none')
  })

  it('applies WebkitTouchCallout style in edit mode', () => {
    const output = getOutput({ name: 'front', isEditing: true, imgSrc: '/img' })
    const style = (
      output as React.ReactElement<{ style?: React.CSSProperties }>
    ).props.style
    expect(style).toMatchObject({ WebkitTouchCallout: 'none' })
  })

  it('drag handle button has a focus-visible class', () => {
    const output = getOutput({ name: 'front', isEditing: true, imgSrc: '/img' })
    const json = JSON.stringify(output)
    expect(json).toContain('focus-visible')
  })
})
