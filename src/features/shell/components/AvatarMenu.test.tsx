// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import { AvatarMenu } from './AvatarMenu'

describe('AvatarMenu', () => {
  const originalFetch = globalThis.fetch
  const originalLocation = window.location
  let assignMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch
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
})
