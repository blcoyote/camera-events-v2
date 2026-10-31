import { describe, expect, it, vi, beforeEach } from 'vitest'
import type React from 'react'
import { SortableCameraTile } from './SortableCameraTile'
import { Button } from '#/features/shared/components/ui/button'

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

type HandleProps = {
  'aria-label'?: string
  className?: string
  children?: unknown
}

function findHandle(node: unknown): React.ReactElement<HandleProps> | null {
  if (!node || typeof node !== 'object') return null
  const el = node as React.ReactElement<HandleProps>
  if (el.props?.['aria-label'] === 'Reorder front') return el
  const children = el.props?.children
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findHandle(child)
    if (found) return found
  }
  return null
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

  it('puts select-none and touch-none on the handle, not the wrapper, in edit mode', () => {
    const output = getOutput({ name: 'front', isEditing: true, imgSrc: '/img' })
    const handle = findHandle(output)
    expect(handle?.props.className).toContain('select-none')
    expect(handle?.props.className).toContain('touch-none')
    const wrapper = (output as React.ReactElement<{ className?: string }>).props
    expect(wrapper.className).not.toContain('touch-none')
  })

  it('handle uses the default icon size, not size-9', () => {
    const handle = findHandle(
      getOutput({ name: 'front', isEditing: true, imgSrc: '/img' }),
    )
    expect(handle?.props.className).not.toContain('size-9')
  })

  it('marks the wrapper as editing with a dashed outline in edit mode', () => {
    const props = (
      getOutput({
        name: 'front',
        isEditing: true,
        imgSrc: '/img',
      }) as React.ReactElement<Record<string, string>>
    ).props
    expect(props['data-editing']).toBe('')
    expect(props.className).toContain('outline-dashed')
  })

  it('has no editing marker or outline in view mode', () => {
    const props = (
      getOutput({
        name: 'front',
        isEditing: false,
        imgSrc: '/img',
      }) as React.ReactElement<Record<string, string>>
    ).props
    expect(props['data-editing']).toBeUndefined()
    expect(props.className ?? '').not.toContain('outline-dashed')
  })

  it('drops the image hover zoom in edit mode only', () => {
    const edit = JSON.stringify(
      getOutput({ name: 'front', isEditing: true, imgSrc: '/img' }),
    )
    const view = JSON.stringify(
      getOutput({ name: 'front', isEditing: false, imgSrc: '/img' }),
    )
    expect(edit).not.toContain('scale-105')
    expect(view).toContain('scale-105')
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

  it('drag handle is the shared Button primitive, which supplies the focus ring', () => {
    const output = getOutput({ name: 'front', isEditing: true, imgSrc: '/img' })
    expect(findHandle(output)?.type).toBe(Button)
  })

  it('links to the live view page for the camera when not editing', () => {
    const output = getOutput({
      name: 'front_porch',
      isEditing: false,
      imgSrc: '/img',
    })
    const json = JSON.stringify(output)
    expect(json).toContain('/live/$name')
    expect(json).toContain('"name":"front_porch"')
  })

  it('does not link to the live view page while editing', () => {
    const output = getOutput({
      name: 'front_porch',
      isEditing: true,
      imgSrc: '/img',
    })
    const json = JSON.stringify(output)
    expect(json).not.toContain('/live/$name')
  })
})

describe('SortableCameraTile (da)', () => {
  it('renders Danish labels', async () => {
    const { withLocale } = await import('#/test-utils/locale')
    const restore = withLocale('da')
    try {
      const json = JSON.stringify(
        getOutput({ name: 'front', isEditing: true, imgSrc: '/img' }),
      )
      expect(json).toContain('Live-visning af front')
      expect(json).toContain('Seneste stillbillede fra front')
      expect(json).toContain('Flyt front')
    } finally {
      restore()
    }
  })
})
