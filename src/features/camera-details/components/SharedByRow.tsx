import { m } from '#/paraglide/messages.js'
import { useState } from 'react'
import { Button } from '#/features/shared/components/ui/button'

export function SharedByRow({
  sharedBy,
  onRemove,
}: {
  sharedBy: (string | null)[]
  onRemove: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  if (sharedBy.length === 0) return null

  const names =
    (sharedBy[0] ?? m.shared_share_someone()) +
    (sharedBy.length > 1 ? ` +${sharedBy.length - 1}` : '')

  const remove = async () => {
    setPending(true)
    try {
      await onRemove()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
      <p>{m.details_shared_by({ names })}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={remove}
      >
        {m.details_share_remove()}
      </Button>
    </div>
  )
}
