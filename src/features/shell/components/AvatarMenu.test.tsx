// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AvatarMenu } from './AvatarMenu'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

describe('AvatarMenu', () => {
  const originalFetch = globalThis.fetch
  const originalLocation = window.location
  let assignMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: false }))
    assignMock = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignMock },
    })
  })

  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
    vi.restoreAllMocks()
  })

  it('renders closed by default with aria-expanded false and no menu', () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders initials when avatarUrl is empty', () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveTextContent('AB')
    expect(trigger.querySelector('img')).toBeNull()
  })

  it('renders avatar image when avatarUrl is non-empty', () => {
    render(
      <AvatarMenu
        avatarUrl="https://example.com/me.png"
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    const img = trigger.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://example.com/me.png')
  })

  it('opens the menu when the trigger is clicked', () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes the menu on Escape key', () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)

    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu on outside click (mousedown on body)', () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls fetch and redirects on sign-out click', async () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)

    const signOutBtn = screen.getByRole('menuitem', { name: 'Sign out' })

    await act(async () => {
      fireEvent.click(signOutBtn)
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    expect(assignMock).toHaveBeenCalledWith('/')
  })

  it('checks admin status on mount', () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/auth/admin-status',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('shows no admin badge before the check resolves (SSR-safe default)', () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true }))

    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Account menu' }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
  })

  it('shows an admin badge once the check reports isAdmin: true', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: true }))

    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('admin-badge')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Account menu (Admin)' }),
    ).toBeInTheDocument()
  })

  it('shows no admin badge when the check reports isAdmin: false', async () => {
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Account menu' }),
    ).toBeInTheDocument()
  })

  it('shows no admin badge when the check rejects', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
  })

  it('shows no admin badge when the check responds 401', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }))

    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('admin-badge')).not.toBeInTheDocument()
  })
})
