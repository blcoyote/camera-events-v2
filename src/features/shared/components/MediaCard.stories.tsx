import type { Meta, StoryObj } from '@storybook/react-vite'
import { MediaCard } from './MediaCard'
import { withRouter } from '../../../../.storybook/decorators/withRouter'

const SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=450&fit=crop'

const meta = {
  title: 'Components/MediaCard',
  component: MediaCard,
  parameters: { layout: 'padded' },
  decorators: [
    withRouter(),
    (Story) => (
      <div className="mx-auto max-w-sm">
        <Story />
      </div>
    ),
  ],
  args: {
    image: (
      <img src={SAMPLE_IMAGE} alt="" className="h-full w-full object-cover" />
    ),
    children: (
      <>
        <p className="text-sm font-semibold text-(--sea-ink)">Backyard</p>
        <p className="text-xs text-(--sea-ink-soft)">2m ago · person</p>
      </>
    ),
  },
} satisfies Meta<typeof MediaCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const AsLink: Story = {
  name: 'As Link (navigable)',
  args: {
    to: '/',
    'aria-label': 'Open event',
  },
}

export const WithOverlay: Story = {
  args: {
    overlay: (
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
        person
      </span>
    ),
  },
}

export const WithoutScanLines: Story = {
  args: { scanLines: false },
}

export const WithIndex: Story = {
  name: 'With animation index',
  args: { index: 3 },
}

export const ImagePlaceholder: Story = {
  name: 'Image not yet loaded',
  args: {
    image: (
      <div className="h-full w-full bg-gradient-to-br from-(--chip-bg) to-(--surface-strong)" />
    ),
  },
}
