// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { m } from '#/paraglide/messages.js'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { FrigateEvent } from '#/features/shared/server/frigate/types'
import type { FrigateResult } from '#/features/shared/server/frigate/config'
import { withLocale } from '#/test-utils/locale'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockToggle = vi.fn()
const mockUseFavoriteToggle = vi.fn(() => ({
  favorited: false,
  pending: false,
  error: null,
  toggle: mockToggle,
}))

vi.mock('#/features/shared/hooks/useFavoriteToggle', () => ({
  useFavoriteToggle: mockUseFavoriteToggle,
}))

const mockFavoriteButton = vi.fn((_props: unknown) => null)
vi.mock('#/features/shared/components/FavoriteButton', () => ({
  FavoriteButton: (props: unknown) => mockFavoriteButton(props),
}))

const mockShareButton = vi.fn((_props: unknown) => null)
vi.mock('../components/ShareButton', () => ({
  ShareButton: (props: { eventId: string }) => {
    mockShareButton(props)
    return React.createElement('div', { 'data-testid': 'share-button' })
  },
}))

const mockDownloadActions = vi.fn((_props: unknown) => null)
vi.mock('../components/DownloadActions', () => ({
  DownloadActions: (props: unknown) => mockDownloadActions(props),
  getDownloadUrl: (id: string, kind: string) =>
    `/api/events/${id}/${kind}?download=true`,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
  }) =>
    React.createElement(
      'a',
      {
        href: to.replace(/\$(\w+)/g, (_, k: string) => params?.[k] ?? ''),
      },
      children,
    ),
}))

const mockUseCameraNeighbors = vi.fn((_event: unknown) => ({
  status: 'ready' as const,
  previous: null,
  next: null,
}))
vi.mock('../hooks/useCameraNeighbors', () => ({
  useCameraNeighbors: (event: unknown) => mockUseCameraNeighbors(event),
}))

const mockEventSnapshot = vi.fn((_props: unknown) => null)
vi.mock('../components/EventSnapshot', () => ({
  EventSnapshot: (props: unknown) => {
    mockEventSnapshot(props)
    return React.createElement('div', { 'data-testid': 'snapshot' })
  },
}))

const mockSnapshotLightbox = vi.fn((_props: unknown) => null)
vi.mock('#/features/shared/components/SnapshotLightbox', () => ({
  SnapshotLightbox: (props: unknown) => {
    mockSnapshotLightbox(props)
    return null
  },
}))

type ClipProps = {
  eventId: string
  poster?: string
  fallback?: React.ReactNode
  onZoom?: () => void
}
const mockEventClipPlayer = vi.fn((_props: ClipProps) => null)
vi.mock('../components/EventClipPlayer', () => ({
  EventClipPlayer: (props: ClipProps) => {
    mockEventClipPlayer(props)
    return React.createElement('video', {
      'data-testid': 'clip-player',
      src: `/api/events/${props.eventId}/clip`,
    })
  },
}))

const mockInfoCard = vi.fn(
  (_props: { label: string; value: React.ReactNode }) => null,
)
vi.mock('../components/InfoCard', () => ({
  InfoCard: (props: { label: string; value: React.ReactNode }) =>
    mockInfoCard(props),
}))

// Import component AFTER mocks
const { CameraEventDetailPage, getDetailPageState, formatDuration } =
  await import('./CameraEventDetailPage')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<FrigateEvent> = {}): FrigateEvent {
  return {
    id: '1713095000.123456-abcdef',
    camera: 'front_porch',
    label: 'person',
    sub_label: null,
    start_time: 1713095000,
    end_time: 1713095060,
    false_positive: null,
    thumbnail: '',
    plus_id: null,
    box: null,
    top_score: null,
    has_clip: false,
    has_snapshot: false,
    retain_indefinitely: false,
    zones: [],
    data: {
      top_score: 0.9,
      score: 0.9,
      attributes: [],
      box: [0, 0, 0, 0],
      region: [0, 0, 0, 0],
      type: 'object',
    },
    ...overrides,
  }
}

function successResult(
  overrides?: Partial<FrigateEvent>,
): FrigateResult<FrigateEvent> {
  return { ok: true, data: makeEvent(overrides) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getDetailPageState', () => {
  // Frigate IDs embed their start time, so the state can be derived without
  // asking Frigate anything: 1713095000 seconds -> 1713095000000 ms.
  const RECENT_ID = '1713095000.123456-abcdef'
  const RECENT_NOW = 1713095000_000 + 10_000

  it('returns the event when the load succeeded', () => {
    const result = successResult()
    expect(getDetailPageState(result, RECENT_ID, RECENT_NOW)).toEqual({
      kind: 'event',
      event: result.ok ? result.data : undefined,
    })
  })

  it('reports a 404 on a freshly started event as still processing', () => {
    // Frigate publishes the "new" MQTT message before it writes the event row,
    // so a notification tapped immediately can arrive ahead of the data.
    const state = getDetailPageState(
      { ok: false, error: 'HTTP 404', status: 404 },
      RECENT_ID,
      RECENT_NOW,
    )
    expect(state.kind).toBe('pending')
  })

  it('reports a 404 past the pending window but under 24h as a ghost', () => {
    const state = getDetailPageState(
      { ok: false, error: 'HTTP 404', status: 404 },
      RECENT_ID,
      1713095000_000 + 60 * 60 * 1000,
    )
    expect(state).toEqual({ kind: 'ghost' })
  })

  it('reports a 404 older than 24h as gone', () => {
    const state = getDetailPageState(
      { ok: false, error: 'HTTP 404', status: 404 },
      RECENT_ID,
      1713095000_000 + 25 * 60 * 60 * 1000,
    )
    expect(state).toEqual({ kind: 'gone' })
  })

  it('reports a 404 as gone when the ID carries no start time', () => {
    const state = getDetailPageState(
      { ok: false, error: 'HTTP 404', status: 404 },
      'not-a-frigate-id-shape',
      RECENT_NOW,
    )
    expect(state).toEqual({ kind: 'gone' })
  })

  it('never treats a non-404 failure as pending, however fresh the ID', () => {
    const state = getDetailPageState(
      { ok: false, error: 'fetch failed' },
      RECENT_ID,
      RECENT_NOW,
    )
    expect(state).toEqual({ kind: 'unreachable' })
  })
})

describe('CameraEventDetailPage', () => {
  describe('with a successful result', () => {
    it('calls useFavoriteToggle with (event.id, true) when initialFavorited=true', () => {
      const event = makeEvent()
      render(
        <CameraEventDetailPage
          result={successResult()}
          initialFavorited={true}
        />,
      )
      expect(mockUseFavoriteToggle).toHaveBeenCalledWith(event.id, true)
    })

    it('calls useFavoriteToggle with (event.id, false) when initialFavorited is omitted', () => {
      const event = makeEvent()
      render(<CameraEventDetailPage result={successResult()} />)
      expect(mockUseFavoriteToggle).toHaveBeenCalledWith(event.id, false)
    })

    it('renders a watch-live link to the event camera in the action row', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(
        screen.getByRole('link', { name: m.details_watch_live() }),
      ).toHaveAttribute('href', '/live/front_porch')
    })

    it('renders a FavoriteButton with the correct eventId', () => {
      const event = makeEvent()
      render(<CameraEventDetailPage result={successResult()} />)
      expect(mockFavoriteButton).toHaveBeenCalled()
      const props = mockFavoriteButton.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect(props.eventId).toBe(event.id)
    })

    it('passes the toggle function from useFavoriteToggle as onToggle to FavoriteButton', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      const props = mockFavoriteButton.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect(props.onToggle).toBe(mockToggle)
    })

    it('shows the certainty as an info row, not a progress bar', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(screen.queryByRole('progressbar')).toBeNull()
      const call = mockInfoCard.mock.calls.find(
        (c) => c[0].label === 'Certainty',
      )
      expect(call?.[0].value).toBe('90%')
    })

    it('shows the snapshot score (as drawn on the image), not the top score', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            data: { ...makeEvent().data, score: 0.83, top_score: 0.91 },
          })}
        />,
      )
      const call = mockInfoCard.mock.calls.find(
        (c) => c[0].label === 'Certainty',
      )
      expect(call?.[0].value).toBe('83%')
    })

    it('omits the certainty row when the score is 0', () => {
      render(
        <CameraEventDetailPage
          result={successResult({
            data: { ...makeEvent().data, score: 0 },
          })}
        />,
      )
      expect(
        mockInfoCard.mock.calls.some((c) => c[0].label === 'Certainty'),
      ).toBe(false)
    })

    it('has no Clip or Snapshot info rows', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      const labels = mockInfoCard.mock.calls.map((c) => c[0].label)
      expect(labels).not.toContain('Clip')
      expect(labels).not.toContain('Snapshot')
    })

    it('formats zone names like camera names', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ zones: ['front_yard', 'driveway'] })}
        />,
      )
      const call = mockInfoCard.mock.calls.find((c) => c[0].label === 'Zones')
      expect(call?.[0].value).toBe('Front Yard, Driveway')
    })

    it('passes clip/snapshot availability to DownloadActions', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: false })}
        />,
      )
      expect(mockDownloadActions).toHaveBeenCalledWith({
        eventId: makeEvent().id,
        hasClip: true,
        hasSnapshot: false,
      })
    })

    it('renders labelled Favorite and Share buttons after the media', () => {
      render(
        <CameraEventDetailPage result={successResult({ has_clip: true })} />,
      )
      const fav = mockFavoriteButton.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect(fav.showLabel).toBe(true)
      expect(mockShareButton).toHaveBeenCalledWith(
        expect.objectContaining({
          showLabel: true,
          label: 'person',
          startTime: 1713095000,
        }),
      )
    })

    it('hides the back link below the sm breakpoint', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      const link = screen.getByRole('link', { name: /back/i })
      expect(link.parentElement).toHaveClass('hidden', 'sm:block')
    })
  })

  describe('error result', () => {
    const OLD_ID = '1713095000.123456-abcdef'

    it('does not render a FavoriteButton on error', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'Not found', status: 404 }}
          eventId={OLD_ID}
        />,
      )
      // Hook is called (React rules: no conditional hooks), but button not rendered
      expect(mockFavoriteButton).not.toHaveBeenCalled()
    })

    it('calls useFavoriteToggle even on error (hooks must be unconditional)', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'Not found', status: 404 }}
          eventId={OLD_ID}
        />,
      )
      expect(mockUseFavoriteToggle).toHaveBeenCalled()
    })

    it('says the event is no longer available for a 404 on a long-past event', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={OLD_ID}
          nowMs={1713095000_000 + 25 * 3_600_000}
        />,
      )
      expect(
        screen.getByRole('heading', { name: /no longer available/i }),
      ).toBeInTheDocument()
      expect(document.querySelector('p.eyebrow')).toBeNull()
    })

    it('says the detection was not saved for a recent 404 past the pending window', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={OLD_ID}
          nowMs={1713095000_000 + 3_600_000}
        />,
      )
      expect(
        screen.getByRole('heading', { name: /wasn't saved/i }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /back/i })).toBeInTheDocument()
    })

    it('says the cameras are unreachable on a non-404 failure, with Try again', () => {
      const onRetry = vi.fn()
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'fetch failed' }}
          eventId={OLD_ID}
          onRetry={onRetry}
        />,
      )
      expect(
        screen.getByRole('heading', { name: /couldn't load this event/i }),
      ).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('hides Try again when there is no retry handler', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'fetch failed' }}
          eventId={OLD_ID}
        />,
      )
      expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
    })
  })

  describe('pending result (Frigate has not written the event yet)', () => {
    const eventId = '1713095000.123456-abcdef'
    const startedAt = 1713095000_000

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(startedAt + 5_000)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('says the event is still being saved rather than that it does not exist', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
        />,
      )
      expect(screen.getByText(/still being saved/i)).toBeInTheDocument()
      expect(screen.queryByText(/no longer available/i)).toBeNull()
    })

    it('announces itself as a status region', () => {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent('Still being saved')
    })

    it('fires one final retry at the deadline so the loader can move on', async () => {
      const onRetry = vi.fn()
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
          onRetry={onRetry}
        />,
      )
      // 5s elapsed of 120s: 115s remain. Ticks every 3s -> 38 ticks reach 114s,
      // the 39th (117s) is past the deadline.
      await vi.advanceTimersByTimeAsync(114_000)
      const before = onRetry.mock.calls.length
      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry.mock.calls.length).toBe(before + 1)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(onRetry.mock.calls.length).toBe(before + 1)
    })

    it('moves focus to the heading when the event arrives', () => {
      const { rerender } = render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
        />,
      )
      rerender(
        <CameraEventDetailPage result={successResult()} eventId={eventId} />,
      )
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1 }),
      )
    })

    it('does not steal focus on a plain event render', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(document.activeElement).toBe(document.body)
    })

    it('retries automatically while the event may still appear', async () => {
      const onRetry = vi.fn()
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
          onRetry={onRetry}
        />,
      )
      expect(onRetry).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('stops retrying once the event is too old to still be pending', async () => {
      const onRetry = vi.fn()
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
          onRetry={onRetry}
        />,
      )

      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(1)

      // Past the pending window: one final look, then stop hammering Frigate.
      vi.setSystemTime(startedAt + 130_000)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(9_000)
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('offers a manual retry', () => {
      const onRetry = vi.fn()
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
          onRetry={onRetry}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: /check again/i }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('does not start another retry while one is still in flight', async () => {
      // The route hands us an async handler and the Frigate client waits up to
      // 10s, so a fixed interval could otherwise stack invalidations.
      let settle: (() => void) | undefined
      const onRetry = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            settle = resolve
          }),
      )

      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
          onRetry={onRetry}
        />,
      )

      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(6_000)
      expect(onRetry).toHaveBeenCalledTimes(1)

      settle?.()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('keeps retrying after a retry rejects', async () => {
      // A rejected refresh must clear the in-flight guard, not wedge the
      // poller — and must be caught, since nothing awaits the returned promise.
      const onRetry = vi.fn(() => Promise.reject(new Error('offline')))

      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId={eventId}
          onRetry={onRetry}
        />,
      )

      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(3_000)
      expect(onRetry).toHaveBeenCalledTimes(2)
    })

    it('does not retry when no retry handler is supplied', () => {
      expect(() => {
        render(
          <CameraEventDetailPage
            result={{ ok: false, error: 'HTTP 404', status: 404 }}
            eventId={eventId}
          />,
        )
        vi.advanceTimersByTime(9_000)
      }).not.toThrow()
    })
  })

  describe('clip as hero', () => {
    const lastClipProps = () => mockEventClipPlayer.mock.calls.at(-1)?.[0]

    it('renders the clip player with no <details> accordion', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      expect(
        document.querySelector('[data-testid="clip-player"]'),
      ).toBeInTheDocument()
      expect(document.querySelector('details')).toBeNull()
      expect(screen.queryByText(/watch clip/i)).toBeNull()
    })

    it('passes the snapshot as poster and fallback when has_snapshot', () => {
      const event = makeEvent()
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      expect(lastClipProps()?.poster).toBe(`/api/events/${event.id}/snapshot`)
      expect(lastClipProps()?.fallback).toBeTruthy()
    })

    it('passes no poster or fallback without a snapshot', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: false })}
        />,
      )
      expect(lastClipProps()?.poster).toBeUndefined()
      expect(lastClipProps()?.fallback).toBeUndefined()
      expect(document.querySelector('[data-testid="snapshot"]')).toBeNull()
    })

    it('opens the lightbox when the clip zoom is triggered', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: true, has_snapshot: true })}
        />,
      )
      expect(mockSnapshotLightbox.mock.calls.at(-1)?.[0]).toMatchObject({
        open: false,
      })
      act(() => lastClipProps()?.onZoom?.())
      expect(mockSnapshotLightbox.mock.calls.at(-1)?.[0]).toMatchObject({
        open: true,
      })
    })

    it('renders the snapshot as hero (no clip player) when there is no clip', () => {
      render(
        <CameraEventDetailPage
          result={successResult({ has_clip: false, has_snapshot: true })}
        />,
      )
      expect(
        document.querySelector('[data-testid="snapshot"]'),
      ).toBeInTheDocument()
      expect(document.querySelector('[data-testid="clip-player"]')).toBeNull()
    })
  })

  describe('same-camera context', () => {
    it('renders the burst nav with a live link even without clip or snapshot', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(screen.getByRole('link', { name: /watch live/i })).toHaveAttribute(
        'href',
        '/live/front_porch',
      )
    })

    it('asks for neighbours of the event, and of nothing on error', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(mockUseCameraNeighbors).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: '1713095000.123456-abcdef' }),
      )
      cleanup()
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'x' }}
          eventId="x"
        />,
      )
      expect(mockUseCameraNeighbors).toHaveBeenLastCalledWith(null)
    })
  })

  describe('header', () => {
    it('has no eyebrow camera paragraph and puts the camera first in the meta line', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(document.querySelector('p.eyebrow')).toBeNull()
      expect(screen.getByText(/^Front Porch ·/)).toBeInTheDocument()
    })

    it('no longer renders a Camera info row', () => {
      render(<CameraEventDetailPage result={successResult()} />)
      expect(mockInfoCard).toHaveBeenCalled()
      expect(mockInfoCard.mock.calls.some(([p]) => p.label === 'Camera')).toBe(
        false,
      )
    })
  })
})

describe('CameraEventDetailPage sharing', () => {
  afterEach(cleanup)

  it('renders the share button on an event', () => {
    render(<CameraEventDetailPage result={successResult()} />)
    expect(screen.getByTestId('share-button')).toBeInTheDocument()
  })

  it('shows who shared the event and wires remove', () => {
    const onRemoveShare = vi.fn().mockResolvedValue(undefined)
    render(
      <CameraEventDetailPage
        result={successResult()}
        sharedBy={['Alice']}
        onRemoveShare={onRemoveShare}
      />,
    )
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onRemoveShare).toHaveBeenCalled()
  })

  it('shows no shared-by row without senders', () => {
    render(<CameraEventDetailPage result={successResult()} />)
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
  })
})

describe('CameraEventDetailPage in Danish', () => {
  it('renders the pending state in Danish', () => {
    const restore = withLocale('da')
    try {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId="1713095000.123456-abcdef"
          nowMs={1713095000_000 + 5_000}
          onRetry={() => {}}
        />,
      )
      expect(screen.getByText('Behandles')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Tjek igen' }),
      ).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('renders the gone state in Danish', () => {
    const restore = withLocale('da')
    try {
      render(
        <CameraEventDetailPage
          result={{ ok: false, error: 'HTTP 404', status: 404 }}
          eventId="1713095000.123456-abcdef"
          nowMs={1713095000_000 + 25 * 3_600_000}
        />,
      )
      expect(
        screen.getByText('Hændelsen er ikke længere tilgængelig'),
      ).toBeInTheDocument()
      expect(screen.getByText('Tilbage til hændelser')).toBeInTheDocument()
    } finally {
      restore()
    }
  })

  it('renders the event page and Danish durations', () => {
    const restore = withLocale('da')
    try {
      render(
        <CameraEventDetailPage result={successResult({ has_clip: true })} />,
      )
      expect(screen.getByText(/^Front Porch ·/)).toBeInTheDocument()
      expect(formatDuration(100, 130)).toBe('30 s')
      expect(formatDuration(100, 280)).toBe('3 min')
      expect(formatDuration(100, 235)).toBe('2 min 15 s')
    } finally {
      restore()
    }
  })

  it('shows Danish certainty label and percent format', () => {
    const restore = withLocale('da')
    try {
      render(<CameraEventDetailPage result={successResult()} />)
      const call = mockInfoCard.mock.calls.find(
        (c) => c[0].label === 'Træfsikkerhed',
      )
      expect(call?.[0].value).toMatch(/^90\s%$/)
    } finally {
      restore()
    }
  })
})
