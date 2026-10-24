import { Link } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'

interface MediaCardProps {
  to?: string
  params?: Record<string, string>
  'aria-label'?: string
  index?: number
  image: ReactNode
  overlay?: ReactNode
  scanLines?: boolean
  children: ReactNode
}

export function MediaCard({
  to,
  params,
  'aria-label': ariaLabel,
  index,
  image,
  overlay,
  scanLines = true,
  children,
}: MediaCardProps) {
  const style =
    index !== undefined
      ? ({ '--i': Math.min(index, 11) } as CSSProperties)
      : undefined

  const cardClass = 'event-card event-card-enter group block no-underline'
  const thumbClass = `relative aspect-video overflow-hidden${scanLines ? ' event-thumb' : ''}`

  const inner = (
    <>
      <div className={thumbClass}>
        {image}
        {overlay}
        <div className="event-meta-fade pointer-events-none absolute inset-x-0 bottom-0 h-16" />
      </div>
      <div className="px-4 py-3">{children}</div>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        params={params as Record<string, string>}
        className={cardClass}
        style={style}
        aria-label={ariaLabel}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className={cardClass} style={style} aria-label={ariaLabel}>
      {inner}
    </div>
  )
}
