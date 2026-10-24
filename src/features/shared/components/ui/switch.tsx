import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '#/features/shared/utils/cn'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-surface-warm transition duration-180 ease-standard outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-transparent relative before:absolute before:-inset-2 before:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-white shadow-raised transition-transform duration-180 ease-standard data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0.5"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
