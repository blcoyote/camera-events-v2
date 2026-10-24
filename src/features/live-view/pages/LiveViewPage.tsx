import { LiveSnapshot } from '#/features/live-view/components/LiveSnapshot'

export function LiveViewPage({ cameraName }: { cameraName: string }) {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="glass rounded-card px-6 py-10 sm:px-10 sm:py-14">
        <p className="eyebrow mb-3">Live View</p>
        <h1 className="text-3xl font-semibold tracking-tight leading-display sm:text-4xl">
          {cameraName}
        </h1>
      </section>
      <div className="mx-auto mt-8 max-w-3xl">
        <LiveSnapshot cameraName={cameraName} />
      </div>
    </main>
  )
}
