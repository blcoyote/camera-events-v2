import { m } from '#/paraglide/messages.js'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '#/features/shared/components/ui/sheet'
import { Button } from '#/features/shared/components/ui/button'
import { Alert } from '#/features/shared/components/ui/alert'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '#/features/shared/components/ui/avatar'
import { Switch } from '#/features/shared/components/ui/switch'
import { translateLabel } from '#/features/shared/utils/labels'
import { formatDateTime } from '#/features/shared/utils/intl'
import { getLocale } from '#/paraglide/runtime.js'
import { getShareRecipientsFn } from '#/features/shared/server/users/users-fns'
import type { ShareRecipient } from '#/features/shared/server/users/types'

const CLOSE_DELAY_MS = 1000
// Matches the share endpoint's MAX_RECIPIENTS.
export const MAX_SHARE_RECIPIENTS = 50

export function ShareSheet({
  eventId,
  open,
  onOpenChange,
  returnFocusRef,
  label,
  startTime,
}: {
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusRef?: RefObject<HTMLElement | null>
  label?: string
  startTime?: number
}) {
  const [recipients, setRecipients] = useState<ShareRecipient[] | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)

  // Bumped whenever an opening ends (close, eventId change, unmount) so older sends go stale.
  const opening = useRef(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRecipients(null)
    setSelected([])
    setSent(false)
    setSending(false)
    setError(false)
    getShareRecipientsFn()
      .then((r) => !cancelled && setRecipients(r))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
      opening.current++
      clearTimeout(closeTimer.current)
    }
  }, [open, eventId])

  const toggle = (sub: string) =>
    setSelected((s) =>
      s.includes(sub)
        ? s.filter((x) => x !== sub)
        : s.length < MAX_SHARE_RECIPIENTS
          ? [...s, sub]
          : s,
    )

  const send = async () => {
    const id = opening.current
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
      if (id !== opening.current) return
      setSent(true)
      closeTimer.current = setTimeout(() => onOpenChange(false), CLOSE_DELAY_MS)
    } catch {
      if (id !== opening.current) return
      setError(true)
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onCloseAutoFocus={(e) => {
          if (!returnFocusRef?.current) return
          e.preventDefault()
          returnFocusRef.current.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>{m.details_share_title()}</SheetTitle>
          {label !== undefined && startTime !== undefined && (
            <SheetDescription>
              {translateLabel(label, getLocale())} ·{' '}
              {formatDateTime(startTime, getLocale())}
            </SheetDescription>
          )}
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
              <Switch
                checked={selected.includes(r.sub)}
                disabled={
                  !selected.includes(r.sub) &&
                  selected.length >= MAX_SHARE_RECIPIENTS
                }
                onCheckedChange={() => toggle(r.sub)}
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
          <p role="status" className="text-fg-2">
            {sent ? m.details_share_sent() : ''}
          </p>
          <Button
            type="button"
            disabled={selected.length === 0 || sending}
            onClick={send}
          >
            {m.details_share_send()}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
