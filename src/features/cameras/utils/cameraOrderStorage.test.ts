// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadOrder, saveOrder, STORAGE_KEY } from './cameraOrderStorage'

function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _reset: () => {
      store = {}
    },
  }
}

let mockStorage: ReturnType<typeof makeLocalStorageMock>

describe('cameraOrderStorage', () => {
  beforeEach(() => {
    mockStorage = makeLocalStorageMock()
    vi.stubGlobal('localStorage', mockStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('loadOrder', () => {
    it('returns null when the key is absent', () => {
      expect(loadOrder()).toBeNull()
    })

    it('returns the parsed array after a successful saveOrder round trip', () => {
      saveOrder(['garage', 'front', 'back'])
      expect(loadOrder()).toEqual(['garage', 'front', 'back'])
    })

    it('returns null and removes the key when stored value is invalid JSON', () => {
      mockStorage.getItem.mockReturnValueOnce('not-json{{')
      expect(loadOrder()).toBeNull()
      expect(mockStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('returns null and removes the key when stored value is valid JSON but not a string array', () => {
      mockStorage.getItem.mockReturnValueOnce(
        JSON.stringify({ cameras: ['a'] }),
      )
      expect(loadOrder()).toBeNull()
      expect(mockStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('returns null and removes the key when individual elements are not strings', () => {
      mockStorage.getItem.mockReturnValueOnce(JSON.stringify([1, 2, 3]))
      expect(loadOrder()).toBeNull()
      expect(mockStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('returns null gracefully in a non-browser environment (no window)', () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('window', undefined)
      expect(() => loadOrder()).not.toThrow()
      expect(loadOrder()).toBeNull()
    })
  })

  describe('saveOrder', () => {
    it('returns { ok: true } on success', () => {
      const result = saveOrder(['front', 'back'])
      expect(result).toEqual({ ok: true })
    })

    it('persists the value so loadOrder reads it back', () => {
      saveOrder(['front', 'back'])
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(['front', 'back']),
      )
    })

    it('returns { ok: false, reason: "quota" } when setItem throws QuotaExceededError', () => {
      mockStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })
      const result = saveOrder(['front', 'back'])
      expect(result).toEqual({ ok: false, reason: 'quota' })
    })

    it('returns { ok: false, reason: "unavailable" } when localStorage access throws', () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('window', undefined)
      const result = saveOrder(['front', 'back'])
      expect(result).toEqual({ ok: false, reason: 'unavailable' })
    })
  })
})
