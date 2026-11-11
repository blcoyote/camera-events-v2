/**
 * Px to translate the fixed tab bar down so its bottom meets the visual
 * viewport bottom; 0 when in sync, pinch-zoomed, or inputs are invalid.
 */
export function computeTabBarOffset(input: {
  navBottom: number
  viewportBottom: number
  viewportScale: number
}): number {
  const { navBottom, viewportBottom, viewportScale } = input
  if (![navBottom, viewportBottom, viewportScale].every(Number.isFinite)) {
    return 0
  }
  if (viewportScale < 0.99 || viewportScale > 1.01) return 0
  const diff = viewportBottom - navBottom
  if (Math.abs(diff) <= 1) return 0
  return Math.round(diff)
}
