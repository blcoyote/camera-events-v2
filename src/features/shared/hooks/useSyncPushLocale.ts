import { useEffect } from 'react'
import { syncPushLocale } from '#/features/shared/utils/pushLocaleSync'

/** Sync the push subscription's locale once after mount (never in render). */
export function useSyncPushLocale(): void {
  useEffect(() => {
    void syncPushLocale()
  }, [])
}
