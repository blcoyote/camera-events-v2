import type { Meta, StoryObj } from '@storybook/react-vite'
import { FavoritesListPage } from './FavoritesListPage'
import { CameraEventsLoading } from './CameraEventsListPage'
import { MOCK_FRIGATE_EVENTS } from '../data/mock-events'
import { withRouter } from '../../../../.storybook/decorators/withRouter'

const meta = {
  title: 'Pages/FavoritesListPage',
  component: FavoritesListPage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FavoritesListPage>

export default meta
type Story = StoryObj<typeof meta>

export const WithEvents: Story = {
  args: {
    events: MOCK_FRIGATE_EVENTS.slice(0, 6),
    favoriteEventIds: MOCK_FRIGATE_EVENTS.slice(0, 6).map((e) => e.id),
  },
}

export const Empty: Story = {
  args: {
    events: [],
    favoriteEventIds: [],
  },
}

export const Loading: StoryObj<typeof CameraEventsLoading> = {
  render: () => <CameraEventsLoading />,
}
