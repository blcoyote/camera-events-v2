// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { withLocale } from '#/test-utils/locale'
import { NotificationSettings } from './NotificationSettings'

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}))
vi.mock('../hooks/usePushSubscription', () => ({
  usePushSubscription: () => hook.state,
}))

const base = {
  isSupported: true,
  isPushEnabled: true,
  permissionState: 'default',
  isSubscribed: false,
  isLoading: false,
  error: null,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  sendTest: vi.fn(),
}

afterEach(cleanup)

describe('NotificationSettings (da)', () => {
  it('renders the unsubscribed state in Danish', async () => {
    const restore = withLocale('da')
    try {
      hook.state = base
      render(<NotificationSettings />)
      expect(
        await screen.findByRole('heading', { name: 'Notifikationer' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Aktivér notifikationer' }),
      ).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('renders the unsupported state in Danish', async () => {
    const restore = withLocale('da')
    try {
      hook.state = { ...base, isSupported: false }
      render(<NotificationSettings />)
      expect(
        await screen.findByText(
          'Pushnotifikationer understøttes ikke i denne browser.',
        ),
      ).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
