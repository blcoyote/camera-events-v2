import type { ReactNode } from 'react'
import { cn } from '#/features/shared/utils/cn'

/*
 * Desktop: glass hero card. Phones: no card, title is sr-only (the top bar
 * shows it), only `actions` stay visible. `sm:rise-in` does not exist (plain
 * class in @layer components gets no variants), so rise-in is unconditional.
 */
export function PageHeader({
  eyebrow,
  title,
  actions,
  className,
  variant = 'default',
}: {
  eyebrow: string
  title: ReactNode
  actions?: ReactNode
  className?: string
  variant?: 'default' | 'spacious'
}) {
  return (
    <section
      className={cn(
        'rise-in sm:glass sm:relative sm:overflow-hidden sm:rounded-card',
        variant === 'spacious' ? 'sm:px-10 sm:py-14' : 'sm:px-8 sm:py-8',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1 hidden sm:block">{eyebrow}</p>
          <h1 className="mb-0 max-w-3xl text-3xl leading-display font-semibold tracking-tight sr-only sm:not-sr-only sm:text-4xl">
            {title}
          </h1>
        </div>
        {actions}
      </div>
    </section>
  )
}
