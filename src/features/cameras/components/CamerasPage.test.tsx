import { describe, expect, it, vi, beforeEach } from 'vitest'
import React from 'react'
import { getCamerasPageState } from './CamerasPage'
import type { FrigateResult } from '#/features/shared/server/frigate/config'

// CamerasPage is tested here by calling it as a function and inspecting
// the returned JSX structure — consistent with the existing project pattern.
// The hook-driven portions (useCameraOrder, SortableCamerasGrid wiring) are
// verified by the Playwright e2e in Step 10.

vi.mock('#/features/cameras/hooks/useCameraOrder', () => ({
  useCameraOrder: (cameras: string[]) => ({
    visibleOrder: cameras,
    setOrder: vi.fn(),
    saveError: null,
    dismissError: vi.fn(),
  }),
  SAVE_ERROR_MESSAGE:
    'Order saved for this session only — storage is full or disabled',
}))

vi.mock('#/features/cameras/components/SortableCamerasGrid', () => ({
  SortableCamerasGrid: ({
    cameras,
    isEditing,
  }: {
    cameras: string[]
    isEditing: boolean
    onOrderChange: (o: string[]) => void
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'sortable-grid', 'data-editing': String(isEditing) },
      cameras.map((c: string) =>
        React.createElement('span', { key: c, 'data-camera': c }, c),
      ),
    ),
}))

import { CamerasPage } from './CamerasPage'

function ok(cameras: string[]): FrigateResult<string[]> {
  return { ok: true, data: cameras }
}
const emptyResult: FrigateResult<string[]> = { ok: true, data: [] }
const errorResult: FrigateResult<string[]> = {
  ok: false,
  error: 'Frigate down',
  status: 503,
}

describe('getCamerasPageState', () => {
  it('returns cameras state when ok and non-empty', () => {
    expect(getCamerasPageState(ok(['a', 'b']))).toEqual({
      kind: 'cameras',
      cameras: ['a', 'b'],
    })
  })

  it('returns empty state when ok but no cameras', () => {
    expect(getCamerasPageState(emptyResult)).toEqual({ kind: 'empty' })
  })

  it('returns error state when not ok', () => {
    const state = getCamerasPageState(errorResult)
    expect(state.kind).toBe('error')
  })
})

describe('CamerasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Edit button when cameras are present and isEditing=false', () => {
    const output = CamerasPage({
      result: ok(['front', 'back']),
      isEditing: false,
      onEditingChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    expect(json).toContain('Edit')
  })

  it('renders Done button when isEditing=true', () => {
    const output = CamerasPage({
      result: ok(['front', 'back']),
      isEditing: true,
      onEditingChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    expect(json).toContain('Done')
  })

  it('calls onEditingChange when Edit button is clicked', () => {
    const onEditingChange = vi.fn()
    const output = CamerasPage({
      result: ok(['front', 'back']),
      isEditing: false,
      onEditingChange,
    })
    // Find the Edit button's onClick handler in the JSX and invoke it
    const json = JSON.stringify(output)
    // Button is present
    expect(json).toContain('Edit')
    // Simulate the click by finding onClick in the element tree
    function findEditButton(
      node: unknown,
    ): React.ReactElement<{ onClick: () => void }> | null {
      if (!node || typeof node !== 'object') return null
      const el = node as React.ReactElement<{
        children?: unknown
        onClick?: () => void
        title?: string
      }>
      if (
        el.props?.title === 'Reorder cameras on this device' &&
        typeof el.props?.onClick === 'function'
      ) {
        return el as React.ReactElement<{ onClick: () => void }>
      }
      const children = el.props?.children
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = findEditButton(child)
          if (found) return found
        }
      } else if (children) {
        return findEditButton(children)
      }
      return null
    }
    const btn = findEditButton(output)
    expect(btn).not.toBeNull()
    btn?.props.onClick()
    expect(onEditingChange).toHaveBeenCalledWith(true)
  })

  it('does not render Edit button when state is empty', () => {
    const output = CamerasPage({
      result: emptyResult,
      isEditing: false,
      onEditingChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    // The Edit button has a title attribute that's unique
    expect(json).not.toContain('Reorder cameras on this device')
  })

  it('does not render Edit button when state is error', () => {
    const output = CamerasPage({
      result: errorResult,
      isEditing: false,
      onEditingChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    expect(json).not.toContain('Reorder cameras on this device')
  })

  it('passes isEditing to SortableCamerasGrid', () => {
    const editOutput = CamerasPage({
      result: ok(['front']),
      isEditing: true,
      onEditingChange: vi.fn(),
    })
    expect(JSON.stringify(editOutput)).toContain('"isEditing":true')
  })

  it('renders per-device scope note', () => {
    const output = CamerasPage({
      result: ok(['front']),
      isEditing: false,
      onEditingChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    expect(json).toContain('Order saved on this device')
  })
})
