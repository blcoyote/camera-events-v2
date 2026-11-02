import { tabBreadcrumb } from '#/features/shared/navigation/tabBreadcrumb'
import { m } from '#/paraglide/messages.js'
import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '#/features/settings/pages/SettingsPage'

export const Route = createFileRoute('/_authenticated/settings')({
  staticData: { breadcrumb: tabBreadcrumb(() => m.shell_tab_settings()) },
  component: SettingsPage,
})
