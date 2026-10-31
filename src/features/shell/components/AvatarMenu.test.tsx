// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps, ReactNode } from 'react'
import '@testing-library/jest-dom/vitest'
import { AvatarMenu } from './AvatarMenu'
import { withLocale } from '#/test-utils/locale'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentProps<'a'> & { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

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

  it('shows initials instead of an image while the avatar has not loaded', () => {
    render(
      <AvatarMenu
        avatarUrl="https://example.com/me.png"
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    expect(trigger).toHaveTextContent('AB')
    expect(trigger.querySelector('img')).toBeNull()
  })

  it('renders avatar image with no-referrer once it loads', async () => {
    // jsdom never loads images, so stub window.Image to fire `load` the way
    // a browser would. Radix Avatar only mounts the <img> after that event.
    class LoadingImage extends EventTarget {
      complete = false
      naturalWidth = 0
      set src(_value: string) {
        queueMicrotask(() => {
          this.complete = true
          this.naturalWidth = 1
          this.dispatchEvent(new Event('load'))
        })
      }
    }
    const originalWindowImage = window.Image
    window.Image = LoadingImage as unknown as typeof Image

    render(
      <AvatarMenu
        avatarUrl="https://example.com/me.png"
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await waitFor(() => {
      expect(trigger.querySelector('img')).not.toBeNull()
    })
    const img = trigger.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/me.png')
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(img).toHaveAttribute('alt', '')
    window.Image = originalWindowImage
  })

  it('opens the menu when the trigger is clicked', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('includes a link to the settings page when open', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('moves focus between menu items with arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    screen.getByRole('button', { name: 'Account menu' }).focus()
    await user.keyboard('{Enter}')

    const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' })
    const settingsItem = screen.getByRole('menuitem', { name: 'Settings' })

    expect(document.activeElement).toBe(signOutItem)
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(settingsItem)
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(signOutItem)
  })

  it('closes the menu when navigating to settings', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu on Escape key', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('returns focus to the trigger when Escape closes the menu', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes the menu on outside pointer press', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls fetch and redirects on sign-out click', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Account menu' })
    await user.click(trigger)

    const signOutBtn = screen.getByRole('menuitem', { name: 'Sign out' })

    await user.click(signOutBtn)

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/')
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('signs out when Enter is pressed on the focused Sign out item', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    screen.getByRole('button', { name: 'Account menu' }).focus()
    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Sign out' }),
    )
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('/')
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('renders Sign out as the submit button of a POST form to signOutAction', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    const item = screen.getByRole('menuitem', { name: 'Sign out' })
    const form = item.closest('form')
    expect(form).not.toBeNull()
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveAttribute('action', '/api/auth/logout')
    expect(item).toHaveAttribute('type', 'submit')
  })

  it('lists menu items in order: Sign out, then Settings', async () => {
    const user = userEvent.setup()
    render(
      <AvatarMenu
        avatarUrl=""
        initials="AB"
        signOutAction="/api/auth/logout"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual(
      ['Sign out', 'Settings'],
    )
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

describe('AvatarMenu in Danish', () => {
  afterEach(() => cleanup())

  it('translates the trigger and menu items', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { isAdmin: false }))
    const restore = withLocale('da')
    try {
      render(<AvatarMenu avatarUrl="" initials="A" signOutAction="/x" />)
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Kontomenu' }))
      expect(
        screen.getByRole('menuitem', { name: 'Log ud' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('menuitem', { name: 'Indstillinger' }),
      ).toBeInTheDocument()
    } finally {
      restore()
    }
  })
})
