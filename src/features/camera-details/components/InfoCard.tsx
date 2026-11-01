export function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="px-3 py-2.5 sm:glass-flat sm:rounded-input sm:p-4">
      <dt className="flex items-center gap-1.5 eyebrow text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground sm:mt-1 sm:text-base">
        {value}
      </dd>
    </div>
  )
}
