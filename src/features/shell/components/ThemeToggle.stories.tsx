import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect } from 'react'
import { useTheme } from '#/features/shared/hooks/useTheme'
import type { ThemeMode } from '#/features/shared/hooks/useTheme'
import ThemeToggle from './ThemeToggle'

function ThemeSeeder({ mode }: { mode: ThemeMode }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    setTheme(mode)
  }, [mode, setTheme])
  return <ThemeToggle />
}

const meta = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LightMode: Story = {
  name: 'Light mode (sun icon)',
  render: () => <ThemeSeeder mode="light" />,
}

export const DarkMode: Story = {
  name: 'Dark mode (moon icon)',
  render: () => <ThemeSeeder mode="dark" />,
}

export const AutoMode: Story = {
  name: 'Auto mode (system icon)',
  render: () => <ThemeSeeder mode="auto" />,
}
