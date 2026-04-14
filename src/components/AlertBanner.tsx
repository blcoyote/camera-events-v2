import { useEffect, useRef, useState } from 'react'

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
    <div
      ref={bannerRef}
      role="alert"
      tabIndex={-1}
      className={`mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200'
          : 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200'
      }`}
    >
      <span>{message.text}</span>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 rounded-lg p-1 transition hover:opacity-100"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
        </svg>
      </button>
    </div>
  )
}
