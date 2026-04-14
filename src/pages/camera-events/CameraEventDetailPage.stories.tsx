import type { Meta, StoryObj } from '@storybook/react-vite'
import { CameraEventDetailPage } from './CameraEventDetailPage'
import { withRouter } from '../../../.storybook/decorators/withRouter'
import { MOCK_FRIGATE_EVENTS } from '../../data/camera-events'

const meta = {
  title: 'Pages/CameraEventDetailPage',
  component: CameraEventDetailPage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CameraEventDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Found: Story = {
  args: { result: { ok: true, data: MOCK_FRIGATE_EVENTS[0] } },
}

export const WithSubLabel: Story = {
  args: { result: { ok: true, data: MOCK_FRIGATE_EVENTS[2] } },
}

export const NotFound: Story = {
  args: { result: { ok: false, error: 'HTTP 404', status: 404 } },
}

export const ServerError: Story = {
  args: { result: { ok: false, error: 'Connection refused' } },
}
