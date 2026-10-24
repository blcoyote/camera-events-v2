import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '#/features/shared/utils/cn'

const badgeVariants = cva(
  'glass inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium shadow-none',
  {
    variants: {
      tone: {
        neutral: 'text-fg-2',
        accent: 'text-brand-strong',
        success: 'text-success-text',
        warn: 'text-warn-text',
        danger: 'text-danger-text',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const dotVariants = cva('size-1.5 rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted-foreground',
      accent: 'bg-brand',
      success: 'bg-success',
      warn: 'bg-warn',
      danger: 'bg-danger',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

function Badge({
  className,
  tone,
  dot = true,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { dot?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {dot && <span aria-hidden="true" className={dotVariants({ tone })} />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Badge, badgeVariants }
