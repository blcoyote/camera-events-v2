import * as React from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'

import { cn } from '#/features/shared/utils/cn'

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(
  props: React.ComponentProps<typeof SheetPrimitive.Trigger>,
) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal(
  props: React.ComponentProps<typeof SheetPrimitive.Portal>,
) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-[60] bg-(--gl-fg)/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

const sideClasses = {
  left: 'inset-y-0 left-0 h-full w-72 rounded-r-hero border-l-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
  right:
    'inset-y-0 right-0 h-full w-72 rounded-l-hero border-r-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
  top: 'inset-x-0 top-0 h-auto rounded-b-hero border-t-0 pt-[env(safe-area-inset-top)] data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
  bottom:
    'inset-x-0 bottom-0 h-auto rounded-t-hero border-b-0 pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
} as const

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  overlayProps,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'left' | 'right' | 'top' | 'bottom'
  showCloseButton?: boolean
  overlayProps?: React.ComponentProps<typeof SheetPrimitive.Overlay> & {
    'data-testid'?: string
  }
}) {
  return (
    <SheetPortal>
      <SheetOverlay {...overlayProps} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'glass-strong fixed z-[70] flex flex-col gap-4 duration-280 ease-standard data-[state=closed]:animate-out data-[state=open]:animate-in',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full text-brand-strong outline-none hover:bg-surface-warm focus-visible:shadow-focus disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        'text-2xl font-semibold tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-fg-2', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
