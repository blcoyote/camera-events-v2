import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '#/features/shared/utils/cn'

const alertVariants = cva(
  'rounded-card border px-4 py-3 text-sm backdrop-blur-glass',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface-hover text-foreground',
        success: 'border-success/40 bg-surface-hover text-success-text',
        destructive: 'border-danger/40 bg-surface-hover text-danger-text',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('text-sm', className)}
      {...props}
    />
  )
}

export { Alert, AlertDescription, alertVariants }
