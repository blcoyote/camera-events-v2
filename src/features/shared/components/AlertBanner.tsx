import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Alert } from '#/features/shared/components/ui/alert'
import { Button } from '#/features/shared/components/ui/button'

type AlertType = 'error' | 'success'

interface AlertMessage {
  text: string
  type: AlertType
}

const ERROR_MESSAGES: Record<string, string> = {
  login_failed: 'Something went wrong during sign-in. Please try again.',
  access_denied: 'You declined the Google sign-in request.',
  invalid_state: 'Something went wrong during sign-in. Please try again.',
}

const STATUS_MESSAGES: Record<string, string> = {
  logged_out: 'You have been signed out.',
}

/**
 * Pure function: determine the alert message to display based on
 * error and status query params.
 */
export function getAlertMessage(
  error: string | undefined,
  status: string | undefined,
): AlertMessage | null {
  if (error && ERROR_MESSAGES[error]) {
    return { text: ERROR_MESSAGES[error], type: 'error' }
  }
  if (status && STATUS_MESSAGES[status]) {
    return { text: STATUS_MESSAGES[status], type: 'success' }
  }
  return null
}

export default function AlertBanner({
  error,
  status,
}: {
  error?: string
  status?: string
}) {
  const message = getAlertMessage(error, status)
  const [dismissed, setDismissed] = useState(false)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message && bannerRef.current) {
      bannerRef.current.focus()
    }
  }, [message])

  useEffect(() => {
    if (message && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      url.searchParams.delete('status')
      window.history.replaceState({}, '', url.toString())
    }
  }, [message])

  if (!message || dismissed) return null

  const isError = message.type === 'error'

  return (
    <Alert
      ref={bannerRef}
      variant={isError ? 'destructive' : 'success'}
      tabIndex={-1}
      className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3"
    >
      <span>{message.text}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss message"
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </Alert>
  )
}
