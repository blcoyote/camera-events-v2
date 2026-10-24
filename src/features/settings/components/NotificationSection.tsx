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
        <CardTitle role="heading" aria-level={2}>
          Notifications
        </CardTitle>
      </CardHeader>
      {children}
    </Card>
  )
}
