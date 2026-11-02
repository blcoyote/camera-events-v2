import { describe, it, expect, vi } from 'vitest'
import { tabBreadcrumb } from './tabBreadcrumb'

const match = { params: {}, search: {}, loaderData: undefined }

describe('tabBreadcrumb', () => {
  it('returns a single crumb without a link', () => {
    const crumbs = tabBreadcrumb(() => 'Cameras')(match)
    expect(crumbs).toEqual([{ label: 'Cameras' }])
    expect(crumbs[0]).not.toHaveProperty('to')
  })

  it('resolves the label lazily on each invocation', () => {
    const label = vi.fn(() => 'X')
    const fn = tabBreadcrumb(label)
    expect(label).not.toHaveBeenCalled()
    fn(match)
    fn(match)
    expect(label).toHaveBeenCalledTimes(2)
  })
})
