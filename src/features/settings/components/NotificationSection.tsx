export function NotificationSection({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <section className="island-shell mt-6 rounded-4xl px-6 py-8 sm:px-10 sm:py-10">
      <h2 className="mb-6 text-lg font-semibold text-(--sea-ink)">
        Notifications
      </h2>
      {children}
    </section>
  )
}
