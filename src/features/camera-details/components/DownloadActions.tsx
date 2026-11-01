import { m } from '#/paraglide/messages.js'
import { Download } from 'lucide-react'
import { Button } from '#/features/shared/components/ui/button'
import { useBlobDownload } from '../hooks/useBlobDownload'

export function getDownloadUrl(
  eventId: string,
  kind: 'clip' | 'snapshot',
): string {
  return `/api/events/${eventId}/${kind}?download=true`
}

export function DownloadActions({
  eventId,
  hasClip,
  hasSnapshot,
}: {
  eventId: string
  hasClip: boolean
  hasSnapshot: boolean
}) {
  const { download, downloading } = useBlobDownload()
  if (!hasClip && !hasSnapshot) return null

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {hasClip && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={downloading}
          onClick={() => download(getDownloadUrl(eventId, 'clip'))}
        >
          <Download size={16} aria-hidden="true" />
          {m.details_download_clip()}
        </Button>
      )}
      {hasSnapshot && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={downloading}
          onClick={() => download(getDownloadUrl(eventId, 'snapshot'))}
        >
          <Download size={16} aria-hidden="true" />
          {m.details_download_snapshot()}
        </Button>
      )}
    </div>
  )
}
