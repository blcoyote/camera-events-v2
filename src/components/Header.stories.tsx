import type { Meta, StoryObj } from '@storybook/react-vite'
import Header from './Header'
import { withRouter } from '../../.storybook/decorators/withRouter'

const meta = {
  title: 'Components/Header',
  component: Header,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Header>

export default meta
type Story = StoryObj<typeof meta>

export const Authenticated: Story = {
  decorators: [
    withRouter({
      user: {
        sub: '123',
        firstName: 'Jane',
        email: 'jane@example.com',
        avatarUrl: 'https://i.pravatar.cc/150',
      },
    }),
  ],
}

export const Unauthenticated: Story = {
  decorators: [withRouter({ user: null })],
}
