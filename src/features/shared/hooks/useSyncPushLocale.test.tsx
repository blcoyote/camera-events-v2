// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSyncPushLocale } from './useSyncPushLocale'
import { syncPushLocale } from '#/features/shared/utils/pushLocaleSync'

vi.mock('#/features/shared/utils/pushLocaleSync', () => ({
  syncPushLocale: vi.fn().mockResolvedValue(undefined),
}))

describe('useSyncPushLocale', () => {
  it('calls syncPushLocale once after mount', () => {
    const { rerender } = renderHook(() => useSyncPushLocale())
    rerender()
    expect(syncPushLocale).toHaveBeenCalledTimes(1)
  })
})
