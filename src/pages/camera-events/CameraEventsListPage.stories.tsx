import type { Meta, StoryObj } from '@storybook/react-vite'
import { CameraEventsListPage } from './CameraEventsListPage'
import { withRouter } from '../../../.storybook/decorators/withRouter'

const meta = {
  title: 'Pages/CameraEventsListPage',
  component: CameraEventsListPage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CameraEventsListPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
