import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MediaCard } from '#/features/shared/components/MediaCard'

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
      className={isEditing ? 'select-none touch-none' : undefined}
    >
      <MediaCard
        index={index}
        scanLines={false}
        image={
          <img
            src={imgSrc}
            alt={`Latest snapshot from ${name}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        }
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--sea-ink)">{name}</h2>
          {isEditing && (
            <button
              type="button"
              aria-label={`Reorder ${name}`}
              className="ml-2 cursor-grab rounded p-1 text-(--sea-ink-soft) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sea-ink) active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M4 5h8M4 8h8M4 11h8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </MediaCard>
    </div>
  )
}
