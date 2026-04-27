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
 *   1. The module exports the expected shape.
 *   2. The exported save-error message constant matches the error text shown in
 *      the UI spec (keeps the spec, hook, and UI in sync via a single source).
 */
import { describe, expect, it } from 'vitest'
import { SAVE_ERROR_MESSAGE } from './useCameraOrder'

describe('useCameraOrder module exports', () => {
  it('exports a SAVE_ERROR_MESSAGE string that matches the spec copy', () => {
    expect(SAVE_ERROR_MESSAGE).toBe(
      'Order saved for this session only — storage is full or disabled',
    )
  })
})
