import type { Meta, StoryObj } from '@storybook/react-vite'
import { CameraEventDetailPage } from './CameraEventDetailPage'
import { withRouter } from '../../../.storybook/decorators/withRouter'

const meta = {
  title: 'Pages/CameraEventDetailPage',
  component: CameraEventDetailPage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CameraEventDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Found: Story = {
  args: { id: 'evt-001' },
}

export const NotFound: Story = {
  args: { id: 'nonexistent' },
}
