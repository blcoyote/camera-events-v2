import { useEffect } from 'react'
import type { RefObject } from 'react'
import { computeTabBarOffset } from './tabBarViewportRepair'

const SETTLE_MS = 300
const SCROLL_DEBOUNCE_MS = 150

function isEditable(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable === true
  )
}

/**
 * Workaround for a WebKit bug in iOS standalone PWAs: after resume from the
 * background and a scroll, a `position: fixed; bottom: 0` element can get
 * stuck mid-screen until relaunch. Detect the misplacement against the visual
 * viewport, force a relayout, and translate the bar back if still wrong.
 */
export function useTabBarViewportRepair(
  navRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const vv = window.visualViewport
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (!vv || !standalone) return

    let rafId: number | null = null
    let settleId: ReturnType<typeof setTimeout> | null = null
    let scrollId: ReturnType<typeof setTimeout> | null = null

    const repair = () => {
      const nav = navRef.current
      if (!nav) return
      // The on-screen keyboard legitimately shrinks the visual viewport.
      if (isEditable(document.activeElement)) return

      // Force a relayout so WebKit recomputes the fixed position.
      nav.style.transform = ''
      nav.style.display = 'none'
      void nav.offsetHeight
      nav.style.display = ''

      const rect = nav.getBoundingClientRect()
      if (rect.height === 0) return // hidden (e.g. desktop via sm:hidden)

      const offset = computeTabBarOffset({
        navBottom: rect.bottom,
        viewportBottom: vv.offsetTop + vv.height,
        viewportScale: vv.scale,
      })
      if (offset !== 0) nav.style.transform = `translateY(${offset}px)`
    }

    const cancelPending = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (settleId !== null) clearTimeout(settleId)
      rafId = null
      settleId = null
    }

    const schedule = () => {
      cancelPending()
      rafId = requestAnimationFrame(() => {
        rafId = null
        repair()
      })
      // iOS updates viewport metrics late after resume.
      settleId = setTimeout(() => {
        settleId = null
        repair()
      }, SETTLE_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    const onScroll = () => {
      if (scrollId !== null) clearTimeout(scrollId)
      scrollId = setTimeout(() => {
        scrollId = null
        schedule()
      }, SCROLL_DEBOUNCE_MS)
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', schedule)
    window.addEventListener('orientationchange', schedule)
    window.addEventListener('scroll', onScroll, { passive: true })
    vv.addEventListener('resize', schedule)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.removeEventListener('scroll', onScroll)
      vv.removeEventListener('resize', schedule)
      cancelPending()
      if (scrollId !== null) clearTimeout(scrollId)
    }
  }, [navRef])
}
