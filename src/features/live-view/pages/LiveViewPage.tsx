import { m } from '#/paraglide/messages.js'
import { LiveSnapshot } from '#/features/live-view/components/LiveSnapshot'
import { Breadcrumbs } from '#/features/shared/navigation/Breadcrumbs'
import { useBreadcrumbs } from '#/features/shared/navigation/useBreadcrumbs'
import { PageHeader } from '#/features/shared/components/PageHeader'

export function LiveViewPage({ cameraName }: { cameraName: string }) {
  const crumbs = useBreadcrumbs()
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-3 sm:pt-14">
      <Breadcrumbs crumbs={crumbs} className="mb-4 hidden sm:block" />
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
