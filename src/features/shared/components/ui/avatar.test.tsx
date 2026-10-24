// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'

afterEach(cleanup)

describe('Avatar', () => {
  it('shows the fallback initials when the image is absent', () => {
    render(
      <Avatar>
        <AvatarImage src="" alt="" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    )

    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('shows the fallback initials while the image has not loaded (jsdom never loads images)', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/me.png" alt="" />
        <AvatarFallback>CD</AvatarFallback>
      </Avatar>,
    )

    expect(screen.getByText('CD')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('marks the root and fallback with data-slot attributes', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>EF</AvatarFallback>
      </Avatar>,
    )

    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull()
    expect(
      container.querySelector('[data-slot="avatar-fallback"]'),
    ).toHaveTextContent('EF')
  })

  it('merges a custom className onto the root', () => {
    const { container } = render(
      <Avatar className="size-11">
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>,
    )

    expect(container.querySelector('[data-slot="avatar"]')).toHaveClass(
      'size-11',
    )
  })
})
