import { LiveSnapshot } from '#/features/live-view/components/LiveSnapshot'

export function LiveViewPage({ cameraName }: { cameraName: string }) {
  return (
    <main id="main-content" className="page-wrap px-4 pb-8 pt-6 sm:pt-14">
      <section className="island-shell rounded-4xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Live View</p>
        <h1 className="display-title text-2xl font-bold text-(--sea-ink) sm:text-4xl">
          {cameraName}
        </h1>
      </section>
      <div className="mx-auto mt-8 max-w-3xl">
        <LiveSnapshot cameraName={cameraName} />
      </div>
    </main>
  )
}
