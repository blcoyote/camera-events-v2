import { describe, it, expect, vi } from 'vitest'
import { resolveBreadcrumbs } from './resolveBreadcrumbs'
import type { BreadcrumbFn } from './types'

const fallback = [{ label: 'Camera Events' }]

describe('resolveBreadcrumbs', () => {
  it('prefers the deepest declaring match', () => {
    const shallow: BreadcrumbFn = () => [{ label: 'shallow' }]
    const deep: BreadcrumbFn = () => [{ label: 'deep' }]
    expect(
      resolveBreadcrumbs([
        { staticData: { breadcrumb: shallow } },
        { staticData: { breadcrumb: deep } },
      ]),
    ).toEqual([{ label: 'deep' }])
  })

  it('skips matches without a breadcrumb', () => {
    const fn: BreadcrumbFn = () => [{ label: 'x' }]
    expect(
      resolveBreadcrumbs([
        { staticData: { breadcrumb: fn } },
        { staticData: {} },
        {},
      ]),
    ).toEqual([{ label: 'x' }])
  })

  it('passes the declaring match params, search and loaderData', () => {
    const fn = vi.fn<BreadcrumbFn>(() => [{ label: 'x' }])
    resolveBreadcrumbs([
      {
        staticData: { breadcrumb: fn },
        params: { id: '1' },
        search: { a: 'b' },
        loaderData: { z: 1 },
      },
      { params: { other: 'no' }, search: { o: 1 }, loaderData: 'other' },
    ])
    expect(fn).toHaveBeenCalledWith({
      params: { id: '1' },
      search: { a: 'b' },
      loaderData: { z: 1 },
    })
  })

  it('falls back to the app title when no match declares a breadcrumb', () => {
    expect(resolveBreadcrumbs([{}, { staticData: {} }])).toEqual(fallback)
  })

  it('falls back when the function returns an empty array', () => {
    expect(
      resolveBreadcrumbs([{ staticData: { breadcrumb: () => [] } }]),
    ).toEqual(fallback)
  })

  it('defaults missing params and search to empty objects', () => {
    const fn = vi.fn<BreadcrumbFn>(() => [{ label: 'x' }])
    resolveBreadcrumbs([{ staticData: { breadcrumb: fn } }])
    expect(fn).toHaveBeenCalledWith({
      params: {},
      search: {},
      loaderData: undefined,
    })
  })
})
