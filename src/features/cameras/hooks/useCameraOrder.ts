import { useState, useEffect, useCallback } from 'react'
import {
  loadOrder,
  saveOrder,
} from '#/features/cameras/utils/cameraOrderStorage'
import { mergeCameraOrder } from '#/features/cameras/utils/mergeCameraOrder'

export const SAVE_ERROR_MESSAGE =
  'Order saved for this session only — storage is full or disabled'

export function useCameraOrder(frigateCameras: string[]) {
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setSavedOrder(loadOrder())
  }, [])

  const visibleOrder = mergeCameraOrder(savedOrder, frigateCameras)

  const setOrder = useCallback((next: string[]) => {
    setSavedOrder(next)
    const result = saveOrder(next)
    if (!result.ok) {
      setSaveError(SAVE_ERROR_MESSAGE)
    }
  }, [])

  const dismissError = useCallback(() => {
    setSaveError(null)
  }, [])

  return { visibleOrder, setOrder, saveError, dismissError }
}
