import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  CameraEventsListPage,
  CameraEventsLoading,
} from './CameraEventsListPage'
import { MOCK_FRIGATE_EVENTS } from '../../data/camera-events'
import { withRouter } from '../../../.storybook/decorators/withRouter'

const meta = {
  title: 'Pages/CameraEventsListPage',
  component: CameraEventsListPage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CameraEventsListPage>

export default meta
type Story = StoryObj<typeof meta>

export const WithEvents: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS },
  },
}

export const Empty: Story = {
  args: {
    result: { ok: true, data: [] },
  },
}

export const Error: Story = {
  args: {
    result: { ok: false, error: 'fetch failed' },
  },
}

export const Loading: StoryObj<typeof CameraEventsLoading> = {
  render: () => <CameraEventsLoading />,
}
