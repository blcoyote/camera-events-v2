import { describe, expect, it, vi, beforeEach } from 'vitest'
import React from 'react'
import { getCamerasPageState, CamerasPage } from './CamerasPage'
import { Button } from '#/features/shared/components/ui/button'
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

  it('renders a PageHeader with the Cameras eyebrow and title', () => {
    const output = CamerasPage({
      result: ok(['front']),
      isEditing: false,
      onEditingChange: vi.fn(),
    })
    const json = JSON.stringify(output)
    expect(json).toContain('"eyebrow":"Cameras"')
    expect(json).toContain('"title":"Latest snapshots"')
  })

  describe('Arrange button', () => {
    function findByType(
      node: unknown,
      type: unknown,
    ): React.ReactElement<any>[] {
      if (!node || typeof node !== 'object') return []
      const el = node as React.ReactElement<any>
      const out: React.ReactElement<any>[] = el.type === type ? [el] : []
      const kids: unknown[] = [el.props?.children, el.props?.actions].flat()
      for (const k of kids) out.push(...findByType(k, type))
      return out
    }
    const render = (
      cameras: FrigateResult<string[]>,
      isEditing = false,
      fn = vi.fn(),
    ) => CamerasPage({ result: cameras, isEditing, onEditingChange: fn })

    it('shows "Arrange" when idle', () => {
      const [btn] = findByType(render(ok(['a', 'b'])), Button)
      expect(JSON.stringify(btn.props.children)).toContain('Arrange')
      expect(btn.props.variant).toBe('secondary')
    })

    it('shows "Done" when editing', () => {
      const [btn] = findByType(render(ok(['a', 'b']), true), Button)
      expect(JSON.stringify(btn.props.children)).toContain('Done')
      expect(btn.props.variant).toBe('default')
    })

    it('clicking enters edit mode', () => {
      const fn = vi.fn()
      findByType(render(ok(['a', 'b']), false, fn), Button)[0].props.onClick()
      expect(fn).toHaveBeenCalledWith(true)
    })

    it('clicking while editing leaves edit mode', () => {
      const fn = vi.fn()
      findByType(render(ok(['a', 'b']), true, fn), Button)[0].props.onClick()
      expect(fn).toHaveBeenCalledWith(false)
    })

    it('is absent with a single camera', () => {
      expect(JSON.stringify(render(ok(['a'])))).not.toContain('Arrange')
    })

    it('is absent when empty or on error', () => {
      expect(JSON.stringify(render(emptyResult))).not.toContain('Arrange')
      expect(JSON.stringify(render(errorResult))).not.toContain('Arrange')
    })

    it('shows the saved-on-this-device hint only when editing', () => {
      expect(JSON.stringify(render(ok(['a', 'b']), true))).toContain(
        'saved on this device only',
      )
      expect(JSON.stringify(render(ok(['a', 'b'])))).not.toContain(
        'saved on this device only',
      )
    })

    it('renders a role=status live region with 2+ cameras', () => {
      expect(JSON.stringify(render(ok(['a', 'b'])))).toContain(
        '"role":"status"',
      )
      expect(JSON.stringify(render(ok(['a'])))).not.toContain('"role":"status"')
    })
  })

  it('passes isEditing to SortableCamerasGrid', () => {
    const editOutput = CamerasPage({
      result: ok(['front']),
      isEditing: true,
      onEditingChange: vi.fn(),
    })
    expect(JSON.stringify(editOutput)).toContain('"isEditing":true')
  })
})
