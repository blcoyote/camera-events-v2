/**
 * useCameraOrder composes three already-tested units:
 *   - mergeCameraOrder (utils/mergeCameraOrder.test.ts)
 *   - loadOrder / saveOrder (utils/cameraOrderStorage.test.ts)
 *   - React state management
 *
 * @testing-library/react's renderHook does not work in this project's vitest
 * setup (React version conflicts — see usePushSubscription.test.ts for the
 * same note). The hook's full behaviour — initial Frigate order, saved-order
 * application after mount, setOrder persistence, saveError surfacing, and
 * dismissError — is therefore covered by the CamerasPage component integration
 * tests (Step 8).
 *
 * This file validates:
 *   1. The save-error message matches the error text shown in
 *      the UI spec (keeps the spec, hook, and UI in sync via a single source).
 */
import { describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages.js'
import { withLocale } from '#/test-utils/locale'

describe('save error copy', () => {
  it('matches the spec copy in English', () => {
    expect(m.cameras_save_error()).toBe(
      'Order saved for this session only — storage is full or disabled',
    )
  })

  it('is translated to Danish', () => {
    const restore = withLocale('da')
    try {
      expect(m.cameras_save_error()).toContain('Rækkefølgen gemmes kun')
    } finally {
      restore()
    }
  })
})
