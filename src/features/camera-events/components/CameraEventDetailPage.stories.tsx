import type { Meta, StoryObj } from '@storybook/react-vite'
import { CameraEventDetailPage } from './CameraEventDetailPage'
import { withRouter } from '../../../../.storybook/decorators/withRouter'
import { MOCK_FRIGATE_EVENTS } from '../data/mock-events'

const meta = {
  title: 'Pages/CameraEventDetailPage',
  component: CameraEventDetailPage,
  decorators: [withRouter()],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CameraEventDetailPage>

export default meta
type Story = StoryObj<typeof meta>

// ─── Desktop (default viewport) ───

export const Found: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS[0] },
    isFavorited: false,
  },
}

export const Favorited: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS[0] },
    isFavorited: true,
  },
}

export const WithSubLabel: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS[2] },
    isFavorited: false,
  },
}

export const NoClip: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS[3] },
    isFavorited: false,
  },
}

export const NotFound: Story = {
  args: {
    result: { ok: false, error: 'HTTP 404', status: 404 },
    isFavorited: false,
  },
}

export const ServerError: Story = {
  args: {
    result: { ok: false, error: 'Connection refused' },
    isFavorited: false,
  },
}

// ─── Mobile viewport ───

export const MobileFound: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS[0] },
    isFavorited: false,
  },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const MobileWithSubLabel: Story = {
  args: {
    result: { ok: true, data: MOCK_FRIGATE_EVENTS[2] },
    isFavorited: false,
  },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}

export const MobileNotFound: Story = {
  args: {
    result: { ok: false, error: 'HTTP 404', status: 404 },
    isFavorited: false,
  },
  parameters: { viewport: { defaultViewport: 'mobile' } },
}
