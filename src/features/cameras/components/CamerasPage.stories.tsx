import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CamerasPage, CamerasLoading } from './CamerasPage'

const meta = {
  title: 'Pages/CamerasPage',
  component: CamerasPage,
  parameters: { layout: 'fullscreen' },
  args: {
    isEditing: false,
    onEditingChange: fn(),
  },
} satisfies Meta<typeof CamerasPage>

export default meta
type Story = StoryObj<typeof meta>

export const WithCameras: Story = {
  args: {
    result: { ok: true, data: ['backyard', 'front_door', 'garage'] },
  },
}

export const EditMode: Story = {
  args: {
    result: { ok: true, data: ['backyard', 'front_door', 'garage'] },
    isEditing: true,
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

export const Loading: StoryObj<typeof CamerasLoading> = {
  render: () => <CamerasLoading />,
}
