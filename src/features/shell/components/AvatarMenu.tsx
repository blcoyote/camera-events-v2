import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages.js'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '#/features/shared/components/ui/avatar'
import { Badge } from '#/features/shared/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/features/shared/components/ui/dropdown-menu'

export function AvatarMenu({
  avatarUrl,
  initials,
  signOutAction,
}: {
  avatarUrl: string
  initials: string
  signOutAction: string
}) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkAdminStatus() {
      try {
        const res = await fetch('/api/auth/admin-status', {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setIsAdmin(Boolean(data.isAdmin))
      } catch {
        // Silently fail — the badge just stays hidden.
      }
    }

    checkAdminStatus()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut(e: FormEvent<HTMLFormElement>) {
    // The form posts natively without JS; with JS we POST via fetch and then
    // hard-navigate home (unchanged behaviour).
    e.preventDefault()
    await fetch(signOutAction, {
      method: 'POST',
      credentials: 'include',
    })
    window.location.assign('/')
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={
            isAdmin ? m.shell_account_menu_admin() : m.shell_account_menu()
          }
          className="glass flex size-11 items-center justify-center overflow-hidden rounded-full shadow-none outline-none focus-visible:shadow-focus"
        >
          <Avatar className="size-full">
            {avatarUrl ? (
              <AvatarImage
                src={avatarUrl}
                alt=""
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback
              aria-hidden="true"
              className="text-sm font-semibold text-brand-strong"
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" aria-label={m.shell_account()}>
          <form method="post" action={signOutAction} onSubmit={handleSignOut}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-left">
                {m.shell_sign_out()}
              </button>
            </DropdownMenuItem>
          </form>
          <DropdownMenuItem asChild>
            <Link to="/settings">{m.shell_tab_settings()}</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isAdmin && (
        <Badge
          tone="accent"
          dot={false}
          aria-hidden="true"
          data-testid="admin-badge"
          title={m.shell_admin()}
          className="pointer-events-none absolute -right-0.5 -bottom-0.5 px-1.5 py-0.5"
        >
          A
        </Badge>
      )}
    </div>
  )
}
