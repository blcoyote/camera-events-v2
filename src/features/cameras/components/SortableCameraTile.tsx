import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MediaCard } from '#/features/shared/components/MediaCard'
import { GripVertical } from 'lucide-react'
import { m } from '#/paraglide/messages.js'
import { Button } from '#/features/shared/components/ui/button'

interface SortableCameraTileProps {
  name: string
  isEditing: boolean
  imgSrc: string
  index?: number
}

export function SortableCameraTile({
  name,
  isEditing,
  imgSrc,
  index,
}: SortableCameraTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: name, disabled: !isEditing })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    ...(isEditing ? { WebkitTouchCallout: 'none' as const } : {}),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isEditing ? { 'data-editing': '' } : {})}
      className={
        isEditing
          ? 'rounded-card outline-2 outline-dashed outline-offset-4 outline-border'
          : undefined
      }
    >
      <MediaCard
        index={index}
        scanLines={false}
        to={isEditing ? undefined : '/live/$name'}
        params={isEditing ? undefined : { name }}
        aria-label={m.cameras_live_view_of({ name })}
        image={
          <img
            src={imgSrc}
            alt={m.cameras_latest_snapshot_from({ name })}
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-300${isEditing ? '' : ' group-hover:scale-105'}`}
          />
        }
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{name}</h2>
          {isEditing && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={m.cameras_reorder({ name })}
              className="ml-2 cursor-grab touch-none select-none text-fg-2 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={18} aria-hidden="true" />
            </Button>
          )}
        </div>
      </MediaCard>
    </div>
  )
}
