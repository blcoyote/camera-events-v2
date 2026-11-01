import { m } from '#/paraglide/messages.js'
import { useState } from 'react'
import { Alert } from '#/features/shared/components/ui/alert'
import { Button } from '#/features/shared/components/ui/button'

export function SharedByRow({
  sharedBy,
  onRemove,
}: {
  sharedBy: (string | null)[]
  onRemove: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  if (sharedBy.length === 0) return null

  const names =
    (sharedBy[0] ?? m.shared_share_someone()) +
    (sharedBy.length > 1 ? ` +${sharedBy.length - 1}` : '')

  const remove = async () => {
    setPending(true)
    setFailed(false)
    try {
      await onRemove()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
      {failed && (
        <Alert variant="destructive">{m.details_share_remove_error()}</Alert>
      )}
    </div>
  )
}
