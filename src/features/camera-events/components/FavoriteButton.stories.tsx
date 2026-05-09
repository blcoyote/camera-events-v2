import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from '@storybook/test'
import { FavoriteButton } from './FavoriteButton'

const meta = {
  title: 'Features/CameraEvents/FavoriteButton',
  component: FavoriteButton,
  parameters: { layout: 'centered' },
  args: {
    eventId: '1713095000.123456-abcdef',
    onToggle: fn(),
  },
} satisfies Meta<typeof FavoriteButton>

export default meta
type Story = StoryObj<typeof meta>

export const Unfavorited: Story = {
  args: {
    favorited: false,
    pending: false,
    error: null,
  },
}

export const Favorited: Story = {
  args: {
    favorited: true,
    pending: false,
    error: null,
  },
}

export const Pending: Story = {
  args: {
    favorited: false,
    pending: true,
    error: null,
  },
}

export const Error: Story = {
  args: {
    favorited: false,
    pending: false,
    error: 'Could not save favorite. Please try again.',
  },
}

/** Mobile viewport story — triggers WCAG 2.5.5 touch target check. */
export const FavoritedMobileViewport: Story = {
  args: {
    favorited: true,
    pending: false,
    error: null,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile' },
  },
}
