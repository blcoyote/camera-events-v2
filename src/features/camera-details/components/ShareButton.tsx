import { m } from '#/paraglide/messages.js'
import { useEffect, useRef, useState } from 'react'
import { Share, Share2 } from 'lucide-react'
import { Button } from '#/features/shared/components/ui/button'
import { ShareSheet } from './ShareSheet'

export function ShareButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Share2 on the server/first render; the iOS-style glyph only after mount.
  const [apple, setApple] = useState(false)
  useEffect(() => {
    setApple(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent))
  }, [])
  const Icon = apple ? Share : Share2

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        aria-label={m.details_share()}
        onClick={() => setOpen(true)}
        className="text-fg-2 hover:bg-transparent hover:text-foreground"
      >
        <Icon size={20} aria-hidden="true" />
      </Button>
      <ShareSheet
        eventId={eventId}
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={buttonRef}
      />
    </>
  )
}
