import type { Meta, StoryObj } from '@storybook/react-vite'
import { HomePage } from './HomePage'
import { withRouter } from '../../../../.storybook/decorators/withRouter'

const meta = {
  title: 'Pages/HomePage',
  component: HomePage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HomePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithError: Story = {
  args: { error: 'login_failed' },
}

export const WithStatus: Story = {
  args: { status: 'logged_out' },
}
