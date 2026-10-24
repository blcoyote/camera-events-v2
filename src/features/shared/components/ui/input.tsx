import * as React from 'react'

import { cn } from '#/features/shared/utils/cn'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'rounded-input border border-border bg-surface-warm px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition duration-180 ease-standard outline-none focus-visible:border-brand focus-visible:shadow-focus aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-55 w-full min-h-11',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
