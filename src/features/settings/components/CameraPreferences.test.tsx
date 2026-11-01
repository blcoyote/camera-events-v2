// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CameraPreferences } from './CameraPreferences'
import { withLocale } from '#/test-utils/locale'

const cameras = [
  { name: 'front_porch', enabled: true },
  { name: 'back_yard', enabled: false },
]

describe('CameraPreferences', () => {
  afterEach(cleanup)

  it('renders a labelled switch per camera with aria-checked state', () => {
    render(
      <CameraPreferences
        cameras={cameras}
        loading={false}
        onToggle={vi.fn()}
      />,
    )
    const front = screen.getByRole('switch', {
      name: 'Notifications for Front Porch',
    })
    const back = screen.getByRole('switch', {
      name: 'Notifications for Back Yard',
    })
    expect(front.getAttribute('aria-checked')).toBe('true')
    expect(back.getAttribute('aria-checked')).toBe('false')
  })

  it('calls onToggle with the inverted value', () => {
    const onToggle = vi.fn()
    render(
      <CameraPreferences
        cameras={cameras}
        loading={false}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(
      screen.getByRole('switch', { name: 'Notifications for Front Porch' }),
    )
    expect(onToggle).toHaveBeenCalledWith('front_porch', false)
    fireEvent.click(
      screen.getByRole('switch', { name: 'Notifications for Back Yard' }),
    )
    expect(onToggle).toHaveBeenCalledWith('back_yard', true)
  })

  it('renders no switches while loading', () => {
    render(<CameraPreferences cameras={cameras} loading onToggle={vi.fn()} />)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })

  it('renders Danish copy', () => {
    const restore = withLocale('da')
    try {
      render(
        <CameraPreferences
          cameras={cameras}
          loading={false}
          onToggle={vi.fn()}
        />,
      )
      expect(screen.getByText('Kameranotifikationer')).toBeTruthy()
      expect(
        screen.getByRole('switch', { name: 'Notifikationer for Front Porch' }),
      ).toBeTruthy()
    } finally {
      restore()
    }
  })
})
