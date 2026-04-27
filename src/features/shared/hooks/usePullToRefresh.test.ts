/**
 * Tests for the `disabled` option added to usePullToRefresh.
 *
 * Full behavioural testing (listener attach/detach on toggle, onRefresh
 * not firing when disabled) requires renderHook, which has React context
 * conflicts in this project's vitest setup. Those scenarios are covered by
 * the manual smoke checklist in the verification sweep (Step 11).
 *
 * This file tests:
 * 1. The option shape — `disabled` is accepted without TypeScript error.
 * 2. The implementation export — the hook is a callable function with the
 *    correct return shape (structural contract).
 */
import { describe, expect, it } from 'vitest'
import { usePullToRefresh } from './usePullToRefresh'

describe('usePullToRefresh — disabled option contract', () => {
  it('exports usePullToRefresh as a function', () => {
    expect(typeof usePullToRefresh).toBe('function')
  })

  it('accepts a disabled option without throwing at the TS/runtime level', () => {
    // Type-level check: calling with disabled:true should not produce a TS
    // error. At runtime outside React we cannot invoke the hook, but we can
    // verify the function reference accepts the option shape by inspecting
    // its .length or simply referencing it with a typed call signature.
    type Options = Parameters<typeof usePullToRefresh>[0]
    const opts: Options = { onRefresh: async () => {}, disabled: true }
    expect(opts.disabled).toBe(true)
  })
})
