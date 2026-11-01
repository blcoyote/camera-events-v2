import { m } from '#/paraglide/messages.js'
import {
  Card,
  CardHeader,
  CardTitle,
} from '#/features/shared/components/ui/card'

export function NotificationSection({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{m.settings_notifications()}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  )
}
