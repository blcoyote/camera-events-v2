// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

afterEach(cleanup)

function renderMenu(onSelect?: () => void) {
  return render(
    <DropdownMenu>
      <DropdownMenuTrigger>Account</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onSelect}>Settings</DropdownMenuItem>
        <DropdownMenuItem>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  )
}

describe('DropdownMenu', () => {
  it('opens on trigger click with menu and menuitems', async () => {
    const user = userEvent.setup()
    renderMenu()
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByRole('menu')).not.toBeNull()
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })
  it('items set their own text colour so link items do not inherit link blue', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Account' }))
    for (const item of screen.getAllByRole('menuitem')) {
      expect(item.className).toContain('text-foreground')
      expect(item.className).toContain('no-underline')
    }
  })

  it('ArrowDown moves focus between items', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Account' }))
    await user.keyboard('{ArrowDown}')
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(items[1])
  })
  it('Escape closes and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Account' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('fires onSelect on click', async () => {
    const user = userEvent.setup()
    const fn = vi.fn()
    renderMenu(fn)
    await user.click(screen.getByRole('button', { name: 'Account' }))
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }))
    expect(fn).toHaveBeenCalledOnce()
  })
})
