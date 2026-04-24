import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { SnapshotLightbox } from './SnapshotLightbox'

const LANDSCAPE =
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1600&h=900&fit=crop'
const PORTRAIT =
  'https://images.unsplash.com/photo-1520975922284-8b456906c813?w=900&h=1600&fit=crop'

const meta = {
  title: 'Components/SnapshotLightbox',
  component: SnapshotLightbox,
  parameters: { layout: 'fullscreen' },
  args: {
    src: LANDSCAPE,
    alt: 'Detected event snapshot',
    open: true,
    onClose: fn(),
  },
} satisfies Meta<typeof SnapshotLightbox>

export default meta
type Story = StoryObj<typeof meta>

export const OpenLandscape: Story = {
  name: 'Open — landscape',
}

export const OpenPortrait: Story = {
  name: 'Open — portrait',
  args: { src: PORTRAIT },
}

export const Closed: Story = {
  name: 'Closed (renders nothing)',
  args: { open: false },
  decorators: [
    (Story) => (
      <div className="flex min-h-screen items-center justify-center text-sm text-(--sea-ink-soft)">
        Lightbox returns null when <code className="mx-1">open=false</code>.
        <Story />
      </div>
    ),
  ],
}

export const Interactive: StoryObj = {
  name: 'Interactive — toggle with a trigger',
  render: () => {
    function Demo() {
      const [open, setOpen] = useState(false)
      return (
        <div className="flex min-h-screen items-center justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center rounded-full border border-(--chip-line) bg-(--chip-bg) px-5 py-2 text-sm font-semibold text-(--sea-ink)"
          >
            Open snapshot
          </button>
          <SnapshotLightbox
            src={LANDSCAPE}
            alt="Detected event snapshot"
            open={open}
            onClose={() => setOpen(false)}
          />
        </div>
      )
    }
    return <Demo />
  },
}
