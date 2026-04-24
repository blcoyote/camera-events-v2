import type { Meta, StoryObj } from '@storybook/react-vite'
import Header from './Header'
import { withRouter } from '../../../../.storybook/decorators/withRouter'

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
        avatarUrl: 'https://i.pravatar.cc/150?img=47',
      },
    }),
  ],
}

export const Unauthenticated: Story = {
  decorators: [withRouter({ user: null })],
}

export const InitialsFallback: Story = {
  name: 'Authenticated — no avatar (initials)',
  decorators: [
    withRouter({
      user: {
        sub: '456',
        firstName: 'Morgan',
        email: 'morgan@example.com',
        avatarUrl: '',
      },
    }),
  ],
}

export const LongFirstName: Story = {
  name: 'Authenticated — long first name',
  decorators: [
    withRouter({
      user: {
        sub: '789',
        firstName: 'Maximilianus',
        email: 'maximilianus@example.com',
        avatarUrl: '',
      },
    }),
  ],
}

export const Mobile: Story = {
  name: 'Authenticated — mobile viewport',
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [
    withRouter({
      user: {
        sub: '123',
        firstName: 'Jane',
        email: 'jane@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=47',
      },
    }),
  ],
}
