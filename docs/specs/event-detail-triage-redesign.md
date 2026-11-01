# Spec: Event Detail Triage Redesign

## Intent

The event detail page (`/camera-events/$id`) is the landing point of every push notification. It should answer "what was it, and is it still going on?" in one look, for a non-technical family member at night. Source: Impeccable critique 2026-11-01 (`.impeccable/critique/`), score 22/40.

## Behaviour

- **Clip is the hero.** With a clip, `EventClipPlayer` renders first with the snapshot as `poster`. With no clip, the snapshot is the hero. If the clip fails, the snapshot replaces it with a compact "couldn't load clip · Try again" row. A zoom button over the media opens the lightbox. On phones the media is edge to edge.
- **Header.** Label as `h1`; one meta line under it: camera · relative time · date-time. No eyebrow.
- **Actions** sit right under the media, labelled pills: Favorite, Share, ● Watch live (`/live/$name`).
- **Same-camera context** (`BurstNav`): previous/next event from the same camera, or "Nothing new from <camera> since". Fetched client-side after mount (`useCameraNeighbors` → `loadCameraNeighborsFn`) so the notification-tap path is not slowed down. `next` is exact only while fewer than 50 newer events exist (see shortcut comment in `load-neighbors.ts`).
- **Metadata** (`dl`): Duration, Zones (formatted like camera names), Certainty (%). Downloads are explicit buttons at the end (`DownloadActions`).
- **States** (`getDetailPageState`):

  | Load result                | State                                                      | Copy gist                                                          |
  | -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
  | ok                         | event                                                      | —                                                                  |
  | 404, < 2 min old           | pending (polls every 3 s; one final retry at the deadline) | "Still being saved"                                                |
  | 404, < 24 h old            | ghost                                                      | "This detection wasn't saved — most likely a false alarm"          |
  | 404 otherwise / invalid ID | gone                                                       | "No longer available — older recordings are removed automatically" |
  | other failure              | unreachable                                                | "The cameras aren't answering — Try again"                         |

  The ghost/gone split is a heuristic: Frigate gives a 404 either way.
- **Accessibility.** Focus moves to the `h1` when a pending event resolves; the pending card is `role="status"`; the share sheet names the event in its description and announces "Sent" through a live region.
- **SSR.** Relative time uses the loader-stamped `loadedAt`, not `Date.now()` during render.

## Cross-platform

No platform-specific APIs. `<video poster playsInline>` behaves the same on iOS Safari, Android Chrome and desktop.
