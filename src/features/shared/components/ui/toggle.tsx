import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { Toggle as TogglePrimitive } from 'radix-ui'

import { cn } from '#/features/shared/utils/cn'

const toggleVariants = cva(
  'glass inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap text-foreground shadow-none transition duration-180 ease-standard hover:bg-surface-hover min-h-11 px-4 py-2 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-transparent focus-visible:shadow-focus outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      size: {
        default: 'min-h-11',
        sm: 'min-h-11',
        lg: 'min-h-11',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

function Toggle({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ size }), className)}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
