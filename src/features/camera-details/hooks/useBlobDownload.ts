import { useCallback, useState } from 'react'

export function useBlobDownload() {
  const [downloading, setDownloading] = useState(false)

  const download = useCallback(async (url: string) => {
    setDownloading(true)
    try {
      const res = await fetch(url, { credentials: 'include' })
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] ?? url.split('/').pop() ?? 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } finally {
      setDownloading(false)
    }
  }, [])

  return { download, downloading }
}
