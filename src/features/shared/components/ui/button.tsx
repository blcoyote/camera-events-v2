import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '#/features/shared/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition duration-180 ease-standard active:translate-y-px disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:shadow-focus [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover',
        secondary: 'glass text-foreground shadow-none hover:bg-surface-hover',
        outline: 'glass text-foreground shadow-none hover:bg-surface-hover',
        ghost: 'text-brand-strong hover:bg-surface-warm',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        link: 'text-brand-strong underline-offset-2 hover:underline',
      },
      size: {
        default: 'min-h-11 px-5 py-3 text-base',
        sm: 'min-h-11 px-4 py-2 text-sm',
        icon: 'size-11 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  type,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      type={asChild ? type : (type ?? 'button')}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span
              aria-hidden="true"
              className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          )}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
