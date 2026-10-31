import type * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '#/features/shared/utils/cn'

/**
 * Styled wrapper around the platform `<select>`. Keeps the OS picker (best UX
 * on iOS/Android) but drops the OS chrome so it matches `Input`.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <div className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          'w-full min-h-11 appearance-none rounded-input border border-border bg-surface-warm py-3 pl-4 pr-10 text-base text-foreground transition duration-180 ease-standard outline-none focus-visible:border-brand focus-visible:shadow-focus aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-55',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        data-slot="native-select-icon"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { NativeSelect }
