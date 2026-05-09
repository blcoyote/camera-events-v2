import { useCallback, useEffect, useRef, useState } from 'react'

export function AvatarMenu({
  avatarUrl,
  initials,
  signOutAction,
}: {
  avatarUrl: string
  initials: string
  signOutAction: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuItemRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    menuItemRef.current?.focus()

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, close])

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        e.preventDefault()
        menuItemRef.current?.focus()
        break
      case 'Tab':
        close()
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-(--line) bg-(--surface) text-sm font-semibold text-(--sea-ink) transition hover:border-(--lagoon-deep)"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-xl border border-(--line) bg-(--surface-strong) shadow-[0_8px_24px_rgba(30,90,72,0.12)]"
        >
          <button
            ref={menuItemRef}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={async () => {
              await fetch(signOutAction, {
                method: 'POST',
                credentials: 'include',
              })
              window.location.assign('/')
            }}
            className="w-full min-h-11 px-4 py-3 text-left text-sm font-medium text-(--sea-ink) transition hover:bg-(--link-bg-hover)"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
