import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from 'react'
import {
  loadOrder,
  saveOrder,
} from '#/features/cameras/utils/cameraOrderStorage'
import { m } from '#/paraglide/messages.js'
import { mergeCameraOrder } from '#/features/cameras/utils/mergeCameraOrder'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useCameraOrder(frigateCameras: string[]) {
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useIsomorphicLayoutEffect(() => {
    setSavedOrder(loadOrder())
  }, [])

  const visibleOrder = useMemo(
    () => mergeCameraOrder(savedOrder, frigateCameras),
    [savedOrder, frigateCameras],
  )

  const setOrder = useCallback((next: string[]) => {
    setSavedOrder(next)
    const result = saveOrder(next)
    if (!result.ok) {
      setSaveError(m.cameras_save_error())
    }
  }, [])

  const dismissError = useCallback(() => {
    setSaveError(null)
  }, [])

  return { visibleOrder, setOrder, saveError, dismissError }
}
