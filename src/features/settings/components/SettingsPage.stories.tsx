import type { Meta, StoryObj } from '@storybook/react-vite'
import { SettingsPage } from './SettingsPage'

const meta = {
  title: 'Pages/SettingsPage',
  component: SettingsPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Mobile: Story = {
  name: 'Mobile viewport',
  globals: { viewport: { value: 'mobile', isRotated: false } },
}

export const Tablet: Story = {
  name: 'Tablet viewport',
  globals: { viewport: { value: 'tablet', isRotated: false } },
}
