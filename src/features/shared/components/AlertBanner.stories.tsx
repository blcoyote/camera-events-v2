import type { Meta, StoryObj } from '@storybook/react-vite'
import AlertBanner from './AlertBanner'

const meta = {
  title: 'Components/AlertBanner',
  component: AlertBanner,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AlertBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Error: Story = {
  args: { error: 'login_failed' },
}

export const Success: Story = {
  args: { status: 'logged_out' },
}

export const NoAlert: Story = {
  args: {},
}
