import { describe, it, expect, afterEach } from 'vitest'
import { liveViewBreadcrumb } from './liveViewBreadcrumb'
import { withLocale } from '#/test-utils/locale'
import type { BreadcrumbMatch } from '#/features/shared/navigation/types'

const match = (name?: string): BreadcrumbMatch => ({
  params: name === undefined ? {} : { name },
  search: {},
  loaderData: undefined,
})

describe('liveViewBreadcrumb', () => {
  let restore: (() => void) | undefined
  afterEach(() => restore?.())

  it('links the parent to /cameras and shows the formatted camera name', () => {
    expect(liveViewBreadcrumb(match('front_door'))).toEqual([
      { label: 'Cameras', to: '/cameras' },
      { label: 'Front Door' },
    ])
  })

  it('translates the parent label', () => {
    restore = withLocale('da')
    expect(liveViewBreadcrumb(match('front_door'))[0]).toEqual({
      label: 'Kameraer',
      to: '/cameras',
    })
  })

  it('tolerates a missing name param', () => {
    expect(liveViewBreadcrumb(match())[1]).toEqual({ label: '' })
  })
})
