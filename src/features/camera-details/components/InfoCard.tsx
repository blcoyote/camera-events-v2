import { Download } from 'lucide-react'
import { useBlobDownload } from '../hooks/useBlobDownload'

export function InfoCard({
  icon: Icon,
  label,
  value,
  downloadUrl,
  'aria-label': ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  downloadUrl?: string
  'aria-label'?: string
}) {
  const { download, downloading } = useBlobDownload()

  const inner = (
    <>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-(--sea-ink-soft)">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-(--sea-ink) sm:mt-1 sm:text-base">
        {value}
        {downloadUrl && (
          <Download
            className="h-3 w-3 text-(--lagoon-deep) sm:h-3.5 sm:w-3.5"
            aria-hidden="true"
          />
        )}
      </dd>
    </>
  )

  if (downloadUrl) {
    return (
      <div className="sm:rounded-xl sm:border sm:border-(--line) sm:bg-(--surface) sm:transition sm:hover:border-(--lagoon-deep) sm:hover:bg-(--accent-hover-bg)">
        <button
          type="button"
          onClick={() => download(downloadUrl)}
          disabled={downloading}
          aria-label={ariaLabel}
          className="block w-full cursor-pointer px-3 py-2.5 text-left sm:p-4"
        >
          {inner}
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-2.5 sm:rounded-xl sm:border sm:border-(--line) sm:bg-(--surface) sm:p-4">
      {inner}
    </div>
  )
}
