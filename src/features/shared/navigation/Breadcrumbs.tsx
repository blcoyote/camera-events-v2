import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { m } from '#/paraglide/messages.js'
import { cn } from '#/features/shared/utils/cn'
import type { Crumb } from './types'

export function Breadcrumbs({
  crumbs,
  className,
}: {
  crumbs: Crumb[]
  className?: string
}) {
  if (crumbs.length < 2) return null

  const lastIndex = crumbs.length - 1

  return (
    <nav aria-label={m.shell_breadcrumb()} className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === lastIndex
          return (
            <li
              key={`${index}-${crumb.label}`}
              className={cn('flex items-center gap-1', isLast && 'min-w-0')}
            >
              {isLast || !crumb.to ? (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="min-w-0 truncate text-sm font-medium text-foreground"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  // `to` is a runtime string here, not a typed route literal
                  to={crumb.to as string}
                  search={crumb.search as never}
                  // Router's prefix match would mark this parent current on the
                  // child page; the last crumb alone owns aria-current.
                  activeOptions={{ exact: true, includeSearch: false }}
                  className="inline-flex min-h-11 items-center py-2 text-sm font-medium text-brand-strong no-underline transition hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
              {!isLast && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
