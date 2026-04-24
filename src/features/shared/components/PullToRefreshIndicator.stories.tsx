import type { Meta, StoryObj } from '@storybook/react-vite'
import { PullToRefreshIndicator } from './PullToRefreshIndicator'

const meta = {
  title: 'Components/PullToRefreshIndicator',
  component: PullToRefreshIndicator,
  parameters: { layout: 'padded' },
  args: {
    threshold: 80,
    pullDistance: 0,
    isRefreshing: false,
    isComplete: false,
  },
  decorators: [
    (Story) => (
      <div className="w-full rounded-2xl border border-(--line) bg-(--surface) p-2">
        <Story />
        <p className="mt-2 px-2 text-xs text-(--sea-ink-soft)">
          Indicator host — page content would appear below this line.
        </p>
      </div>
    ),
  ],
} satisfies Meta<typeof PullToRefreshIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const PullingPartial: Story = {
  name: 'Pulling — below threshold',
  args: { pullDistance: 32 },
}

export const PullingThreshold: Story = {
  name: 'Pulling — at threshold',
  args: { pullDistance: 80 },
}

export const PullingPastThreshold: Story = {
  name: 'Pulling — past threshold (arrow flipped)',
  args: { pullDistance: 110 },
}

export const Refreshing: Story = {
  name: 'Refreshing (spinner)',
  args: { isRefreshing: true, pullDistance: 80 },
}

export const Complete: Story = {
  name: 'Refreshed (checkmark)',
  args: { isComplete: true, pullDistance: 80 },
}
