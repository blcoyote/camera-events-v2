import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { NotificationSettings } from './NotificationSettings'
import type { UsePushSubscriptionReturn } from '#/hooks/usePushSubscription'

// Mock the hook module for all stories
const mockHookValues: UsePushSubscriptionReturn = {
  isSupported: true,
  isPushEnabled: true,
  permissionState: 'granted',
  isSubscribed: true,
  isLoading: false,
  error: null,
  subscribe: fn(),
  unsubscribe: fn(),
  sendTest: fn().mockResolvedValue(1),
}

const meta = {
  title: 'Pages/Settings/NotificationSettings',
  component: NotificationSettings,
  parameters: { layout: 'padded' },
  beforeEach: () => {
    // Reset mock values to defaults before each story
    Object.assign(mockHookValues, {
      isSupported: true,
      isPushEnabled: true,
      permissionState: 'granted' as NotificationPermission,
      isSubscribed: true,
      isLoading: false,
      error: null,
    })
  },
} satisfies Meta<typeof NotificationSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Enabled: Story = {
  name: 'Notifications Enabled',
}

export const Disabled: Story = {
  name: 'Notifications Disabled (Not Subscribed)',
  beforeEach: () => {
    Object.assign(mockHookValues, {
      permissionState: 'default' as NotificationPermission,
      isSubscribed: false,
    })
  },
}

export const Unsupported: Story = {
  name: 'Browser Not Supported',
  beforeEach: () => {
    Object.assign(mockHookValues, {
      isSupported: false,
    })
  },
}

export const Blocked: Story = {
  name: 'Permission Blocked',
  beforeEach: () => {
    Object.assign(mockHookValues, {
      permissionState: 'denied' as NotificationPermission,
      isSubscribed: false,
    })
  },
}

export const PushNotConfigured: Story = {
  name: 'Server Not Configured (No VAPID)',
  beforeEach: () => {
    Object.assign(mockHookValues, {
      isPushEnabled: false,
    })
  },
}

export const Loading: Story = {
  name: 'Loading State',
  beforeEach: () => {
    Object.assign(mockHookValues, {
      isLoading: true,
    })
  },
}

export const WithError: Story = {
  beforeEach: () => {
    Object.assign(mockHookValues, {
      error: 'Could not enable notifications. Please try again.',
      isSubscribed: false,
      permissionState: 'default' as NotificationPermission,
    })
  },
}
