import { m } from '#/paraglide/messages.js'
import { LiveSnapshot } from '#/features/live-view/components/LiveSnapshot'
import { PageHeader } from '#/features/shared/components/PageHeader'

export function LiveViewPage({ cameraName }: { cameraName: string }) {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <PageHeader
        eyebrow={m.shell_title_live_view()}
        title={cameraName}
        variant="spacious"
      />
      <div className="mx-auto mt-8 max-w-3xl">
        <LiveSnapshot cameraName={cameraName} />
      </div>
    </main>
  )
}
