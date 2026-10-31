import type * as React from 'react'

import { cn } from '#/features/shared/utils/cn'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('skeleton-shimmer', className)}
      {...props}
    />
  )
}

export { Skeleton }
