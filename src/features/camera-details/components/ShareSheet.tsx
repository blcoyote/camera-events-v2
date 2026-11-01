import { m } from '#/paraglide/messages.js'
import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '#/features/shared/components/ui/sheet'
import { Button } from '#/features/shared/components/ui/button'
import { Alert } from '#/features/shared/components/ui/alert'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '#/features/shared/components/ui/avatar'
import { getShareRecipientsFn } from '#/features/shared/server/users/users-fns'
import type { ShareRecipient } from '#/features/shared/server/users/types'

const CLOSE_DELAY_MS = 1000

export function ShareSheet({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [recipients, setRecipients] = useState<ShareRecipient[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRecipients(null)
    setError(false)
    getShareRecipientsFn()
      .then((r) => !cancelled && setRecipients(r))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [open])

  const toggle = (sub: string) =>
    setSelected((s) =>
      s.includes(sub) ? s.filter((x) => x !== sub) : [...s, sub],
    )

  const send = async () => {
    setSending(true)
    setError(false)
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/share`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientIds: selected }),
        },
      )
      if (!res.ok) throw new Error(String(res.status))
      setSent(true)
      setTimeout(() => {
        onOpenChange(false)
        setSelected([])
        setSent(false)
        setSending(false)
      }, CLOSE_DELAY_MS)
    } catch {
      setError(true)
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{m.details_share_title()}</SheetTitle>
        </SheetHeader>
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-4">
          {error && (
            <Alert variant="destructive">{m.details_share_error()}</Alert>
          )}
          {!recipients && !error && (
            <p className="text-fg-2">{m.details_share_loading()}</p>
          )}
          {recipients?.length === 0 && (
            <p className="text-fg-2">{m.details_share_empty()}</p>
          )}
          {recipients?.map((r) => (
            <label
              key={r.sub}
              className="flex min-h-11 cursor-pointer items-center gap-3 text-foreground"
            >
              <input
                type="checkbox"
                className="size-5 accent-brand"
                checked={selected.includes(r.sub)}
                onChange={() => toggle(r.sub)}
              />
              <Avatar aria-hidden="true">
                {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                <AvatarFallback>{r.displayName.charAt(0)}</AvatarFallback>
              </Avatar>
              {r.displayName}
            </label>
          ))}
        </div>
        <SheetFooter>
          <Button
            type="button"
            disabled={selected.length === 0 || sending}
            onClick={send}
          >
            {sent ? m.details_share_sent() : m.details_share_send()}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
