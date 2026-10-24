// Polyfills for APIs Radix UI needs that jsdom lacks. Some test files run in
// the node environment, so everything is guarded on `window`.
if (typeof window !== 'undefined') {
  const proto = Element.prototype as unknown as Record<string, unknown>
  proto.hasPointerCapture ??= () => false
  proto.releasePointerCapture ??= () => {}
  proto.setPointerCapture ??= () => {}
  proto.scrollIntoView ??= () => {}

  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as Record<string, unknown>).ResizeObserver =
      ResizeObserverStub
  }
}
